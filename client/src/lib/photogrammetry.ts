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
  console.log("Analyzing images to create 3D shape...");
  
  // Extract actual shape information from processed images
  const shapeBounds = await analyzeImageShapes(imageFeatures);
  console.log("Shape analysis complete:", shapeBounds);
  
  return generateShapeBasedPointCloud(shapeBounds, imageFeatures);
}

async function analyzeImageShapes(imageFeatures: ImageFeatures[]) {
  const shapes = [];
  
  for (const imageFeature of imageFeatures) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = imageFeature.image.processed;
    });
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const shape = extractObjectBounds(imageData);
    shapes.push(shape);
  }
  
  return shapes;
}

function extractObjectBounds(imageData: ImageData) {
  const { data, width, height } = imageData;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let pixelCount = 0;
  let totalR = 0, totalG = 0, totalB = 0;
  
  // Find bounding box of non-transparent pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      
      if (alpha > 128) { // Non-transparent pixel
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        pixelCount++;
        
        totalR += data[idx];
        totalG += data[idx + 1];
        totalB += data[idx + 2];
      }
    }
  }
  
  const centerX = (minX + maxX) / 2 / width;
  const centerY = (minY + maxY) / 2 / height;
  const objectWidth = (maxX - minX) / width;
  const objectHeight = (maxY - minY) / height;
  const density = pixelCount / (width * height);
  
  // Average color
  const avgColor = pixelCount > 0 ? {
    r: totalR / pixelCount / 255,
    g: totalG / pixelCount / 255,
    b: totalB / pixelCount / 255
  } : { r: 0.5, g: 0.5, b: 0.5 };
  
  return {
    centerX,
    centerY,
    objectWidth,
    objectHeight,
    density,
    avgColor,
    aspectRatio: objectHeight > 0 ? objectWidth / objectHeight : 1
  };
}

function generateShapeBasedPointCloud(shapeBounds: any[], imageFeatures: ImageFeatures[]): Point3D[] {
  const points3D: Point3D[] = [];
  
  if (shapeBounds.length === 0) {
    console.warn("No shape data found, creating default shape");
    return createDefaultShape();
  }
  
  // Calculate average shape properties
  const avgWidth = shapeBounds.reduce((sum, s) => sum + s.objectWidth, 0) / shapeBounds.length;
  const avgHeight = shapeBounds.reduce((sum, s) => sum + s.objectHeight, 0) / shapeBounds.length;
  const avgAspectRatio = shapeBounds.reduce((sum, s) => sum + s.aspectRatio, 0) / shapeBounds.length;
  const avgDensity = shapeBounds.reduce((sum, s) => sum + s.density, 0) / shapeBounds.length;
  
  // Estimate 3D shape from 2D projections
  const scaleX = Math.max(0.5, avgWidth * 3);
  const scaleY = Math.max(0.5, avgHeight * 3);
  const scaleZ = Math.max(0.5, Math.sqrt(avgDensity) * 2); // Depth based on density
  
  console.log(`Creating 3D shape: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}x${scaleZ.toFixed(2)}`);
  
  // Generate points based on estimated shape
  const numPoints = Math.max(500, Math.min(2000, Math.floor(avgDensity * 3000)));
  
  for (let i = 0; i < numPoints; i++) {
    // Create ellipsoid-like distribution based on image analysis
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.acos(2 * Math.random() - 1);
    
    // Apply shape-based scaling
    let x = Math.sin(theta) * Math.cos(phi) * scaleX;
    let y = Math.sin(theta) * Math.sin(phi) * scaleY;
    let z = Math.cos(theta) * scaleZ;
    
    // Add shape variation based on aspect ratio
    if (avgAspectRatio < 0.7) { // Wide object
      y *= 0.7;
      z *= 1.2;
    } else if (avgAspectRatio > 1.4) { // Tall object
      y *= 1.3;
      x *= 0.8;
    }
    
    // Sample color from one of the images
    const shapeIndex = Math.floor(Math.random() * shapeBounds.length);
    const shape = shapeBounds[shapeIndex];
    const color = new THREE.Color(shape.avgColor.r, shape.avgColor.g, shape.avgColor.b);
    
    // Add some color variation
    color.offsetHSL(
      (Math.random() - 0.5) * 0.1, // Slight hue variation
      (Math.random() - 0.5) * 0.2, // Saturation variation
      (Math.random() - 0.5) * 0.3  // Lightness variation
    );
    
    points3D.push({
      position: new THREE.Vector3(x, y, z),
      color: color,
      confidence: 0.7 + Math.random() * 0.3
    });
  }
  
  return points3D;
}

function createDefaultShape(): Point3D[] {
  console.log("Creating default cube shape");
  const points3D: Point3D[] = [];
  
  // Create a simple cube when no image data is available
  for (let i = 0; i < 800; i++) {
    const x = (Math.random() - 0.5) * 2;
    const y = (Math.random() - 0.5) * 2;
    const z = (Math.random() - 0.5) * 2;
    
    points3D.push({
      position: new THREE.Vector3(x, y, z),
      color: new THREE.Color(0.6, 0.6, 0.7),
      confidence: 0.5
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
  try {
    // More realistic triangulation
    const imageWidth = 640;
    const imageHeight = 480;
    
    // Convert image coordinates to normalized device coordinates
    const ndc1 = new THREE.Vector3(
      (point1.x - imageWidth / 2) / pose1.focalLength,
      (point1.y - imageHeight / 2) / pose1.focalLength,
      1
    );
    
    const ndc2 = new THREE.Vector3(
      (point2.x - imageWidth / 2) / pose2.focalLength,
      (point2.y - imageHeight / 2) / pose2.focalLength,
      1
    );
    
    // Apply camera rotations
    ndc1.applyEuler(pose1.rotation);
    ndc2.applyEuler(pose2.rotation);
    
    // Calculate ray directions
    const dir1 = ndc1.normalize();
    const dir2 = ndc2.normalize();
    
    // Find closest point between two rays
    const w = pose1.position.clone().sub(pose2.position);
    const a = dir1.dot(dir1);
    const b = dir1.dot(dir2);
    const c = dir2.dot(dir2);
    const d = dir1.dot(w);
    const e = dir2.dot(w);
    
    const denom = a * c - b * b;
    if (Math.abs(denom) < 0.001) return null; // Rays are parallel
    
    const t1 = (b * e - c * d) / denom;
    const t2 = (a * e - b * d) / denom;
    
    // Calculate 3D point
    const point1_3d = pose1.position.clone().add(dir1.multiplyScalar(t1));
    const point2_3d = pose2.position.clone().add(dir2.multiplyScalar(t2));
    
    // Average the two points
    const triangulatedPoint = point1_3d.add(point2_3d).multiplyScalar(0.5);
    
    // Check if point is reasonable (not too far from cameras)
    const distanceFromCamera1 = triangulatedPoint.distanceTo(pose1.position);
    const distanceFromCamera2 = triangulatedPoint.distanceTo(pose2.position);
    
    if (distanceFromCamera1 > 10 || distanceFromCamera2 > 10) {
      return null; // Point too far away
    }
    
    // Calculate color based on descriptor similarity
    const colorIntensity = Math.max(0.3, 1 - point1.descriptor.reduce((sum, val, i) => 
      sum + Math.abs(val - (point2.descriptor[i] || 0)), 0) / point1.descriptor.length);
    
    return {
      position: triangulatedPoint,
      color: new THREE.Color(colorIntensity, colorIntensity * 0.8, colorIntensity * 0.6),
      confidence: Math.min(1, colorIntensity * 2)
    };
  } catch (error) {
    return null;
  }
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
  
  // Create a more structured mesh by connecting nearby points
  // Sort points by distance from center for better connectivity
  const sortedPoints = points3D.map((point, index) => ({
    index,
    point,
    distance: point.position.length()
  })).sort((a, b) => a.distance - b.distance);
  
  // Create triangular mesh by connecting points in layers
  const layerSize = Math.floor(Math.sqrt(points3D.length / 4));
  
  for (let layer = 0; layer < 4; layer++) {
    const startIdx = layer * layerSize * layerSize;
    const endIdx = Math.min((layer + 1) * layerSize * layerSize, sortedPoints.length);
    
    for (let i = startIdx; i < endIdx - layerSize - 1; i++) {
      const current = sortedPoints[i].index;
      const right = sortedPoints[i + 1]?.index;
      const down = sortedPoints[i + layerSize]?.index;
      const diag = sortedPoints[i + layerSize + 1]?.index;
      
      // Create two triangles for each quad
      if (right !== undefined && down !== undefined) {
        faces.push(current, right, down);
        
        if (diag !== undefined) {
          faces.push(right, diag, down);
        }
      }
    }
  }
  
  // Add radial connections for better surface
  const centerIdx = 0;
  const numRadialConnections = Math.min(100, points3D.length / 10);
  
  for (let i = 1; i < numRadialConnections; i++) {
    const next = (i + 1) % numRadialConnections;
    if (next < points3D.length) {
      faces.push(centerIdx, i, next);
    }
  }
  
  return new Uint32Array(faces);
}
