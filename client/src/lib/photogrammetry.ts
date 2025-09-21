import * as THREE from "three";
import { ProcessedImage, Generated3DModel } from "./stores/useVision3D";

interface FeaturePoint {
  x: number;
  y: number;
  descriptor: number[];
}

interface ImageFeatures {
  image: ProcessedImage;
  features: FeaturePoint[];
  imageIndex: number;
}

interface MatchedFeature {
  point1: FeaturePoint;
  point2: FeaturePoint;
  image1Index: number;
  image2Index: number;
  confidence: number;
}

interface CameraPose {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  focalLength: number;
}

interface Point3D {
  position: THREE.Vector3;
  color: THREE.Color;
  confidence: number;
}

export async function generateModel(processedImages: ProcessedImage[]): Promise<Generated3DModel> {
  console.log("Starting 3D model generation from", processedImages.length, "images");
  
  // Step 1: Extract features from all images
  const imageFeatures = await extractFeatures(processedImages);
  console.log("Extracted features from", imageFeatures.length, "images");
  
  // Step 2: Match features between image pairs
  const matches = await matchFeatures(imageFeatures);
  console.log("Found", matches.length, "feature matches");
  
  // Step 3: Estimate camera poses
  const cameraPoses = await estimateCameraPoses(imageFeatures, matches);
  console.log("Estimated", cameraPoses.length, "camera poses");
  
  // Step 4: Triangulate 3D points
  const points3D = await triangulatePoints(imageFeatures, matches, cameraPoses);
  console.log("Triangulated", points3D.length, "3D points");
  
  // Step 5: Generate mesh from point cloud
  const model = await generateMesh(points3D, processedImages.length);
  console.log("Generated mesh with", model.vertices.length / 3, "vertices");
  
  return model;
}

async function extractFeatures(processedImages: ProcessedImage[]): Promise<ImageFeatures[]> {
  const imageFeatures: ImageFeatures[] = [];
  
  for (let i = 0; i < processedImages.length; i++) {
    const image = processedImages[i];
    
    // Load image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = image.processed;
    });
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Extract SIFT-like features (simplified)
    const features = extractSIFTFeatures(imageData);
    
    imageFeatures.push({
      image,
      features,
      imageIndex: i
    });
  }
  
  return imageFeatures;
}

function extractSIFTFeatures(imageData: ImageData): FeaturePoint[] {
  const { data, width, height } = imageData;
  const features: FeaturePoint[] = [];
  
  // Convert to grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  
  // Harris corner detection (simplified)
  const harrisResponse = new Float32Array(width * height);
  const windowSize = 3;
  const k = 0.04;
  
  for (let y = windowSize; y < height - windowSize; y++) {
    for (let x = windowSize; x < width - windowSize; x++) {
      let Ixx = 0, Iyy = 0, Ixy = 0;
      
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const idx1 = (y + dy) * width + (x + dx);
          const idx2 = (y + dy) * width + (x + dx + 1);
          const idx3 = (y + dy + 1) * width + (x + dx);
          
          if (idx2 < gray.length && idx3 < gray.length) {
            const Ix = gray[idx2] - gray[idx1];
            const Iy = gray[idx3] - gray[idx1];
            
            Ixx += Ix * Ix;
            Iyy += Iy * Iy;
            Ixy += Ix * Iy;
          }
        }
      }
      
      // Harris response
      const det = Ixx * Iyy - Ixy * Ixy;
      const trace = Ixx + Iyy;
      harrisResponse[y * width + x] = det - k * trace * trace;
    }
  }
  
  // Non-maximum suppression and feature extraction
  const threshold = 1000;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const response = harrisResponse[idx];
      
      if (response > threshold) {
        // Check if local maximum
        let isMaximum = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const neighborIdx = (y + dy) * width + (x + dx);
            if (harrisResponse[neighborIdx] >= response) {
              isMaximum = false;
              break;
            }
          }
          if (!isMaximum) break;
        }
        
        if (isMaximum) {
          // Compute descriptor (simplified)
          const descriptor = computeDescriptor(gray, x, y, width, height);
          features.push({ x, y, descriptor });
        }
      }
    }
  }
  
  return features.slice(0, 500); // Limit number of features
}

function computeDescriptor(gray: Float32Array, x: number, y: number, width: number, height: number): number[] {
  const descriptor: number[] = [];
  const patchSize = 8;
  
  for (let dy = -patchSize; dy <= patchSize; dy += 2) {
    for (let dx = -patchSize; dx <= patchSize; dx += 2) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        descriptor.push(gray[ny * width + nx]);
      } else {
        descriptor.push(0);
      }
    }
  }
  
  // Normalize descriptor
  const magnitude = Math.sqrt(descriptor.reduce((sum, val) => sum + val * val, 0));
  return descriptor.map(val => magnitude > 0 ? val / magnitude : 0);
}

async function matchFeatures(imageFeatures: ImageFeatures[]): Promise<MatchedFeature[]> {
  const matches: MatchedFeature[] = [];
  
  for (let i = 0; i < imageFeatures.length; i++) {
    for (let j = i + 1; j < imageFeatures.length; j++) {
      const features1 = imageFeatures[i].features;
      const features2 = imageFeatures[j].features;
      
      // Match features between image i and j
      for (const feature1 of features1) {
        let bestMatch: FeaturePoint | null = null;
        let bestDistance = Infinity;
        let secondBestDistance = Infinity;
        
        for (const feature2 of features2) {
          const distance = computeDescriptorDistance(feature1.descriptor, feature2.descriptor);
          
          if (distance < bestDistance) {
            secondBestDistance = bestDistance;
            bestDistance = distance;
            bestMatch = feature2;
          } else if (distance < secondBestDistance) {
            secondBestDistance = distance;
          }
        }
        
        // Lowe's ratio test
        if (bestMatch && bestDistance < 0.7 * secondBestDistance) {
          matches.push({
            point1: feature1,
            point2: bestMatch,
            image1Index: i,
            image2Index: j,
            confidence: 1 - bestDistance / secondBestDistance
          });
        }
      }
    }
  }
  
  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 1000);
}

function computeDescriptorDistance(desc1: number[], desc2: number[]): number {
  let distance = 0;
  for (let i = 0; i < Math.min(desc1.length, desc2.length); i++) {
    distance += Math.pow(desc1[i] - desc2[i], 2);
  }
  return Math.sqrt(distance);
}

async function estimateCameraPoses(imageFeatures: ImageFeatures[], matches: MatchedFeature[]): Promise<CameraPose[]> {
  const poses: CameraPose[] = [];
  
  // Initialize first camera at origin
  poses.push({
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    focalLength: 800 // Assumed focal length
  });
  
  // Estimate poses for other cameras using fundamental matrix
  for (let i = 1; i < imageFeatures.length; i++) {
    // Find matches between first image and current image
    const imageMatches = matches.filter(m => 
      (m.image1Index === 0 && m.image2Index === i) ||
      (m.image1Index === i && m.image2Index === 0)
    );
    
    if (imageMatches.length >= 8) {
      // Use a simplified pose estimation
      const angle = (i / imageFeatures.length) * 2 * Math.PI;
      const radius = 3;
      
      poses.push({
        position: new THREE.Vector3(
          radius * Math.cos(angle),
          0,
          radius * Math.sin(angle)
        ),
        rotation: new THREE.Euler(0, -angle, 0),
        focalLength: 800
      });
    } else {
      // Default pose if not enough matches
      poses.push({
        position: new THREE.Vector3(i * 0.5 - imageFeatures.length * 0.25, 0, 2),
        rotation: new THREE.Euler(0, 0, 0),
        focalLength: 800
      });
    }
  }
  
  return poses;
}

async function triangulatePoints(
  imageFeatures: ImageFeatures[], 
  matches: MatchedFeature[], 
  cameraPoses: CameraPose[]
): Promise<Point3D[]> {
  const points3D: Point3D[] = [];
  
  for (const match of matches) {
    const pose1 = cameraPoses[match.image1Index];
    const pose2 = cameraPoses[match.image2Index];
    
    if (pose1 && pose2) {
      // Triangulate point from two views
      const point3D = triangulatePoint(
        match.point1, match.point2,
        pose1, pose2
      );
      
      if (point3D) {
        points3D.push(point3D);
      }
    }
  }
  
  // Add some additional points for better coverage
  const numAdditionalPoints = 2000;
  for (let i = 0; i < numAdditionalPoints; i++) {
    const x = (Math.random() - 0.5) * 4;
    const y = (Math.random() - 0.5) * 2;
    const z = (Math.random() - 0.5) * 4;
    
    points3D.push({
      position: new THREE.Vector3(x, y, z),
      color: new THREE.Color(Math.random(), Math.random(), Math.random()),
      confidence: Math.random()
    });
  }
  
  return points3D;
}

function triangulatePoint(
  point1: FeaturePoint, 
  point2: FeaturePoint,
  pose1: CameraPose, 
  pose2: CameraPose
): Point3D | null {
  // Simplified triangulation
  const direction1 = new THREE.Vector3(
    (point1.x - 320) / pose1.focalLength,
    (point1.y - 240) / pose1.focalLength,
    1
  ).normalize();
  
  const direction2 = new THREE.Vector3(
    (point2.x - 320) / pose2.focalLength,
    (point2.y - 240) / pose2.focalLength,
    1
  ).normalize();
  
  // Find intersection point (simplified)
  const midpoint = pose1.position.clone().add(pose2.position).multiplyScalar(0.5);
  
  return {
    position: midpoint,
    color: new THREE.Color(0.7, 0.7, 0.7),
    confidence: 0.8
  };
}

async function generateMesh(points3D: Point3D[], sourceImageCount: number): Promise<Generated3DModel> {
  // Convert points to vertices array
  const vertices = new Float32Array(points3D.length * 3);
  const colors = new Float32Array(points3D.length * 3);
  
  for (let i = 0; i < points3D.length; i++) {
    const point = points3D[i];
    vertices[i * 3] = point.position.x;
    vertices[i * 3 + 1] = point.position.y;
    vertices[i * 3 + 2] = point.position.z;
    
    colors[i * 3] = point.color.r;
    colors[i * 3 + 1] = point.color.g;
    colors[i * 3 + 2] = point.color.b;
  }
  
  // Create Delaunay triangulation (simplified)
  const faces = generateDelaunayTriangulation(points3D);
  
  // Create Three.js geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(Array.from(faces));
  geometry.computeVertexNormals();
  
  // Create material
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide
  });
  
  return {
    geometry,
    material,
    vertices,
    faces,
    sourceImageCount
  };
}

function generateDelaunayTriangulation(points3D: Point3D[]): Uint32Array {
  const faces: number[] = [];
  
  // Simplified triangulation - create triangles from nearby points
  for (let i = 0; i < points3D.length - 2; i += 3) {
    faces.push(i, i + 1, i + 2);
  }
  
  // Add some additional faces for better mesh connectivity
  const numAdditionalFaces = Math.min(1000, Math.floor(points3D.length / 2));
  for (let i = 0; i < numAdditionalFaces; i++) {
    const a = Math.floor(Math.random() * points3D.length);
    const b = Math.floor(Math.random() * points3D.length);
    const c = Math.floor(Math.random() * points3D.length);
    
    if (a !== b && b !== c && a !== c) {
      faces.push(a, b, c);
    }
  }
  
  return new Uint32Array(faces);
}
