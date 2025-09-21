import * as THREE from "three";
import { ProcessedImage, Generated3DModel } from "./stores/useVision3D";

declare global {
  interface Window {
    cv: any;
    cvReady: boolean;
  }
}

interface FeaturePoint {
  x: number;
  y: number;
  response: number;
  angle?: number;
  octave?: number;
}

interface ImageFeatures {
  image: ProcessedImage;
  features: FeaturePoint[];
  descriptors: any; // OpenCV Mat
  keypoints: any; // OpenCV KeyPointVector
  imageIndex: number;
  mat: any; // OpenCV Mat for the image
}

interface MatchedFeature {
  point1: FeaturePoint;
  point2: FeaturePoint;
  image1Index: number;
  image2Index: number;
  confidence: number;
  queryIdx: number;
  trainIdx: number;
}

interface CameraPose {
  position: THREE.Vector3;
  rotation: THREE.Matrix3;
  translation: THREE.Vector3;
  intrinsicMatrix: THREE.Matrix3;
  projectionMatrix: THREE.Matrix4;
  isValid: boolean;
  reprojectionError: number;
}

interface Point3D {
  position: THREE.Vector3;
  color: THREE.Color;
  confidence: number;
  reprojectionError: number;
  viewCount: number;
}

interface ReconstructionResult {
  points3D: Point3D[];
  cameras: CameraPose[];
  success: boolean;
  errorMessage?: string;
}

export async function generateModel(processedImages: ProcessedImage[]): Promise<Generated3DModel> {
  console.log("Starting Structure-from-Motion reconstruction from", processedImages.length, "images");
  
  // Wait for OpenCV to be ready
  await waitForOpenCV();
  
  try {
    // Step 1: Extract ORB features from all images
    const imageFeatures = await extractORBFeatures(processedImages);
    console.log("Extracted ORB features from", imageFeatures.length, "images");
    
    // Step 2: Match features between image pairs using robust matching
    const matches = await robustFeatureMatching(imageFeatures);
    console.log("Found", matches.length, "robust feature matches");
    
    // Step 3: Estimate camera intrinsics from EXIF or use defaults
    const intrinsicsData = await estimateCameraIntrinsics(processedImages[0]);
    const intrinsics = intrinsicsData.intrinsics;
    console.log(`Estimated camera intrinsics for ${intrinsicsData.width}x${intrinsicsData.height} images`);
    
    // Step 4: Perform Structure-from-Motion reconstruction
    const reconstruction = await performSfMReconstruction(imageFeatures, matches, intrinsics);
    
    if (!reconstruction.success) {
      console.warn("SfM reconstruction failed:", reconstruction.errorMessage);
      return createFallbackModel(processedImages);
    }
    
    console.log("Reconstructed", reconstruction.points3D.length, "3D points from", reconstruction.cameras.length, "cameras");
    
    // Step 5: Generate mesh from point cloud
    const model = await generateMeshFromPointCloud(reconstruction.points3D);
    console.log("Generated mesh with", model.vertices.length / 3, "vertices");
    
    // Cleanup OpenCV resources
    cleanupOpenCVResources(imageFeatures);
    
    return model;
    
  } catch (error) {
    console.error("Error in photogrammetry pipeline:", error);
    return createFallbackModel(processedImages);
  }
}

async function waitForOpenCV(): Promise<void> {
  if (window.cvReady) return;
  
  return new Promise((resolve) => {
    const checkCV = () => {
      if (window.cvReady) {
        resolve();
      } else {
        setTimeout(checkCV, 100);
      }
    };
    checkCV();
  });
}

async function extractORBFeatures(processedImages: ProcessedImage[]): Promise<ImageFeatures[]> {
  const imageFeatures: ImageFeatures[] = [];
  const cv = window.cv;
  
  // Create ORB detector with optimized parameters
  const orb = new cv.ORB_create(1000, 1.2, 8, 31, 0, 2, cv.ORB_HARRIS_SCORE, 31, 20);
  
  for (let i = 0; i < processedImages.length; i++) {
    const image = processedImages[i];
    
    try {
      // Load image into OpenCV Mat
      const mat = await loadImageToMat(image.processed, cv);
      
      // Convert to grayscale (handle both RGB and RGBA inputs)
      const gray = new cv.Mat();
      if (mat.channels() === 4) {
        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
      } else if (mat.channels() === 3) {
        cv.cvtColor(mat, gray, cv.COLOR_RGB2GRAY);
      } else {
        mat.copyTo(gray);
      }
      
      // Detect ORB features
      const keypoints = new cv.KeyPointVector();
      const descriptors = new cv.Mat();
      
      orb.detectAndCompute(gray, new cv.Mat(), keypoints, descriptors);
      
      // Convert keypoints to our format
      const features: FeaturePoint[] = [];
      for (let j = 0; j < keypoints.size(); j++) {
        const kp = keypoints.get(j);
        features.push({
          x: kp.pt.x,
          y: kp.pt.y,
          response: kp.response,
          angle: kp.angle,
          octave: kp.octave
        });
      }
      
      imageFeatures.push({
        image,
        features,
        descriptors: descriptors.clone(),
        keypoints: keypoints.clone(),
        imageIndex: i,
        mat: gray.clone()
      });
      
      // Cleanup temporary matrices
      mat.delete();
      gray.delete();
      keypoints.delete();
      descriptors.delete();
      
    } catch (error) {
      console.error(`Error extracting features from image ${i}:`, error);
    }
  }
  
  orb.delete();
  return imageFeatures;
}

async function loadImageToMat(imageSrc: string, cv: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Limit image size for performance
      const maxSize = 1600;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      try {
        const mat = cv.imread(canvas);
        resolve(mat);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = reject;
    img.src = imageSrc;
  });
}

async function robustFeatureMatching(imageFeatures: ImageFeatures[]): Promise<MatchedFeature[]> {
  const cv = window.cv;
  const matches: MatchedFeature[] = [];
  
  // Create BF matcher for ORB descriptors (Hamming distance)
  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false); // crossCheck = false for knnMatch
  
  // Match each pair of images
  for (let i = 0; i < imageFeatures.length; i++) {
    for (let j = i + 1; j < imageFeatures.length; j++) {
      try {
        // Use knnMatch for Lowe's ratio test
        const knnMatches = new cv.DMatchVectorVector();
        matcher.knnMatch(imageFeatures[i].descriptors, imageFeatures[j].descriptors, knnMatches, 2);
        
        const goodMatches: any[] = [];
        
        // Apply Lowe's ratio test
        for (let k = 0; k < knnMatches.size(); k++) {
          const match = knnMatches.get(k);
          if (match.size() >= 2) {
            const m1 = match.get(0);
            const m2 = match.get(1);
            
            // Lowe's ratio test: distance ratio should be < 0.75
            if (m1.distance < 0.75 * m2.distance && m1.distance < 40) {
              goodMatches.push(m1);
            }
          }
        }
        
        // Optional: Cross-check for additional robustness
        const crossCheckMatches: any[] = [];
        if (goodMatches.length > 0) {
          const backMatches = new cv.DMatchVectorVector();
          matcher.knnMatch(imageFeatures[j].descriptors, imageFeatures[i].descriptors, backMatches, 2);
          
          for (const match of goodMatches) {
            // Check if the back-match exists
            for (let l = 0; l < backMatches.size(); l++) {
              const backMatch = backMatches.get(l);
              if (backMatch.size() > 0) {
                const bm = backMatch.get(0);
                if (bm.queryIdx === match.trainIdx && bm.trainIdx === match.queryIdx) {
                  crossCheckMatches.push(match);
                  break;
                }
              }
            }
          }
          
          backMatches.delete();
        }
        
        // Use cross-checked matches if available, otherwise use good matches
        const finalMatches = crossCheckMatches.length > 20 ? crossCheckMatches : goodMatches;
        
        // Sort by distance and keep best matches
        finalMatches.sort((a, b) => a.distance - b.distance);
        const bestMatches = finalMatches.slice(0, Math.min(200, finalMatches.length));
        
        console.log(`Image pair ${i}-${j}: ${bestMatches.length} robust matches`);
        
        // Convert to our match format
        for (const match of bestMatches) {
          const point1 = imageFeatures[i].features[match.queryIdx];
          const point2 = imageFeatures[j].features[match.trainIdx];
          
          if (point1 && point2) {
            matches.push({
              point1,
              point2,
              image1Index: i,
              image2Index: j,
              confidence: 1 / (1 + match.distance),
              queryIdx: match.queryIdx,
              trainIdx: match.trainIdx
            });
          }
        }
        
        knnMatches.delete();
        
      } catch (error) {
        console.error(`Error matching features between images ${i} and ${j}:`, error);
      }
    }
  }
  
  matcher.delete();
  console.log(`Total robust matches across all pairs: ${matches.length}`);
  return matches;
}

async function estimateCameraIntrinsics(image: ProcessedImage): Promise<{ intrinsics: THREE.Matrix3; width: number; height: number }> {
  // Load image to get actual dimensions after scaling
  const cv = window.cv;
  const mat = await loadImageToMat(image.processed, cv);
  
  const width = mat.cols;
  const height = mat.rows;
  
  mat.delete(); // Clean up
  
  // Default focal length assumption (1.2 * image width is common)
  const fx = width * 1.2;
  const fy = fx; // Assume square pixels
  const cx = width / 2;
  const cy = height / 2;
  
  const intrinsics = new THREE.Matrix3().set(
    fx, 0, cx,
    0, fy, cy,
    0, 0, 1
  );
  
  return { intrinsics, width, height };
}

async function performSfMReconstruction(
  imageFeatures: ImageFeatures[], 
  matches: MatchedFeature[], 
  intrinsics: THREE.Matrix3
): Promise<ReconstructionResult> {
  
  if (matches.length < 50) {
    return {
      points3D: [],
      cameras: [],
      success: false,
      errorMessage: "Insufficient feature matches for reconstruction"
    };
  }
  
  try {
    // Find the best image pair for initialization
    const initPair = findBestInitialPair(matches, imageFeatures);
    if (!initPair) {
      return {
        points3D: [],
        cameras: [],
        success: false,
        errorMessage: "Could not find suitable image pair for initialization"
      };
    }
    
    // Perform two-view reconstruction
    const twoViewResult = await performTwoViewReconstruction(
      initPair.matches,
      imageFeatures[initPair.image1],
      imageFeatures[initPair.image2],
      intrinsics
    );
    
    if (!twoViewResult.success) {
      return {
        points3D: [],
        cameras: [],
        success: false,
        errorMessage: "Two-view reconstruction failed"
      };
    }
    
    console.log(`Two-view reconstruction successful: ${twoViewResult.points3D.length} points`);
    
    return {
      points3D: twoViewResult.points3D,
      cameras: twoViewResult.cameras,
      success: true
    };
    
  } catch (error) {
    return {
      points3D: [],
      cameras: [],
      success: false,
      errorMessage: `SfM reconstruction error: ${error}`
    };
  }
}

function findBestInitialPair(matches: MatchedFeature[], imageFeatures: ImageFeatures[]) {
  const pairCounts = new Map<string, MatchedFeature[]>();
  
  // Group matches by image pairs
  for (const match of matches) {
    const key = `${match.image1Index}-${match.image2Index}`;
    if (!pairCounts.has(key)) {
      pairCounts.set(key, []);
    }
    pairCounts.get(key)!.push(match);
  }
  
  // Find pair with most matches
  let bestPair: { image1: number; image2: number; matches: MatchedFeature[] } | null = null;
  let maxMatches = 0;
  
  for (const entry of Array.from(pairCounts.entries())) {
    const [key, pairMatches] = entry;
    if (pairMatches.length > maxMatches && pairMatches.length >= 50) {
      const [img1, img2] = key.split('-').map(Number);
      bestPair = {
        image1: img1,
        image2: img2,
        matches: pairMatches
      };
      maxMatches = pairMatches.length;
    }
  }
  
  return bestPair;
}

async function performTwoViewReconstruction(
  matches: MatchedFeature[],
  features1: ImageFeatures,
  features2: ImageFeatures,
  intrinsics: THREE.Matrix3
): Promise<{ success: boolean; points3D: Point3D[]; cameras: CameraPose[] }> {
  
  const cv = window.cv;
  
  try {
    // Prepare point arrays for essential matrix estimation
    const points1 = [];
    const points2 = [];
    
    for (const match of matches) {
      points1.push(match.point1.x, match.point1.y);
      points2.push(match.point2.x, match.point2.y);
    }
    
    const pts1 = cv.matFromArray(matches.length, 1, cv.CV_32FC2, points1);
    const pts2 = cv.matFromArray(matches.length, 1, cv.CV_32FC2, points2);
    
    // Create camera matrix (THREE.Matrix3 is row-major, use elements directly)
    const K = cv.matFromArray(3, 3, cv.CV_64F, [
      intrinsics.elements[0], intrinsics.elements[1], intrinsics.elements[2],
      intrinsics.elements[3], intrinsics.elements[4], intrinsics.elements[5],
      intrinsics.elements[6], intrinsics.elements[7], intrinsics.elements[8]
    ]);
    
    // Estimate essential matrix using RANSAC
    const essentialMatrix = cv.findEssentialMat(pts1, pts2, K, cv.RANSAC, 0.999, 1.0);
    
    if (essentialMatrix.rows === 0) {
      pts1.delete();
      pts2.delete();
      K.delete();
      essentialMatrix.delete();
      return { success: false, points3D: [], cameras: [] };
    }
    
    // Recover pose from essential matrix
    const R = new cv.Mat();
    const t = new cv.Mat();
    const mask = new cv.Mat();
    
    const inlierCount = cv.recoverPose(essentialMatrix, pts1, pts2, K, R, t, mask);
    console.log(`Pose recovery: ${inlierCount}/${matches.length} inliers`);
    
    if (inlierCount < 50) {
      pts1.delete();
      pts2.delete();
      K.delete();
      essentialMatrix.delete();
      R.delete();
      t.delete();
      mask.delete();
      return { success: false, points3D: [], cameras: [] };
    }
    
    // Create camera poses
    const camera1: CameraPose = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Matrix3().identity(),
      translation: new THREE.Vector3(0, 0, 0),
      intrinsicMatrix: intrinsics.clone(),
      projectionMatrix: new THREE.Matrix4(),
      isValid: true,
      reprojectionError: 0
    };
    
    // Extract rotation matrix elements
    const RArray = [];
    for (let i = 0; i < 9; i++) {
      RArray.push(R.data64F[i]);
    }
    
    // Extract translation vector
    const tVec = new THREE.Vector3(t.data64F[0], t.data64F[1], t.data64F[2]);
    
    // Camera 2 position: C = -R^T * t
    const RMat = new THREE.Matrix3().fromArray(RArray);
    const RTMat = RMat.clone().transpose();
    const camera2Position = tVec.clone().negate().applyMatrix3(RTMat);
    
    const camera2: CameraPose = {
      position: camera2Position,
      rotation: RMat,
      translation: tVec,
      intrinsicMatrix: intrinsics.clone(),
      projectionMatrix: new THREE.Matrix4(),
      isValid: true,
      reprojectionError: 0
    };
    
    // Triangulate 3D points using OpenCV
    const points3D = await triangulatePointsOpenCV(matches, camera1, camera2, intrinsics, mask, pts1, pts2, K, R, t);
    
    // Cleanup OpenCV resources
    pts1.delete();
    pts2.delete();
    K.delete();
    essentialMatrix.delete();
    R.delete();
    t.delete();
    mask.delete();
    
    return {
      success: true,
      points3D,
      cameras: [camera1, camera2]
    };
    
  } catch (error) {
    console.error("Two-view reconstruction error:", error);
    return { success: false, points3D: [], cameras: [] };
  }
}

async function triangulatePointsOpenCV(
  matches: MatchedFeature[],
  camera1: CameraPose,
  camera2: CameraPose,
  intrinsics: THREE.Matrix3,
  mask: any,
  pts1: any,
  pts2: any,
  K: any,
  R: any,
  t: any
): Promise<Point3D[]> {
  
  const cv = window.cv;
  const points3D: Point3D[] = [];
  
  try {
    // Create projection matrices
    // P1 = K[I|0]
    const I = cv.Mat.eye(3, 3, cv.CV_64F);
    const zeros = cv.Mat.zeros(3, 1, cv.CV_64F);
    const Rt1 = new cv.Mat();
    cv.hconcat(I, zeros, Rt1);
    const P1 = new cv.Mat();
    cv.gemm(K, Rt1, 1, new cv.Mat(), 0, P1);
    
    // P2 = K[R|t]
    const Rt2 = new cv.Mat();
    cv.hconcat(R, t, Rt2);
    const P2 = new cv.Mat();
    cv.gemm(K, Rt2, 1, new cv.Mat(), 0, P2);
    
    // Filter inlier points
    const inlierPts1 = [];
    const inlierPts2 = [];
    const inlierMatches = [];
    
    for (let i = 0; i < matches.length; i++) {
      if (mask.ucharPtr(i, 0)[0] !== 0) { // Is inlier
        inlierPts1.push(matches[i].point1.x, matches[i].point1.y);
        inlierPts2.push(matches[i].point2.x, matches[i].point2.y);
        inlierMatches.push(matches[i]);
      }
    }
    
    if (inlierPts1.length < 10) {
      I.delete();
      zeros.delete();
      Rt1.delete();
      P1.delete();
      Rt2.delete();
      P2.delete();
      return points3D;
    }
    
    const inlierMat1 = cv.matFromArray(inlierPts1.length / 2, 1, cv.CV_32FC2, inlierPts1);
    const inlierMat2 = cv.matFromArray(inlierPts2.length / 2, 1, cv.CV_32FC2, inlierPts2);
    
    // Triangulate points
    const points4D = new cv.Mat();
    cv.triangulatePoints(P1, P2, inlierMat1, inlierMat2, points4D);
    
    // Convert from homogeneous to 3D coordinates
    for (let i = 0; i < points4D.cols; i++) {
      const X = points4D.data64F[i * 4];
      const Y = points4D.data64F[i * 4 + 1];
      const Z = points4D.data64F[i * 4 + 2];
      const W = points4D.data64F[i * 4 + 3];
      
      if (Math.abs(W) > 1e-6) {
        const x = X / W;
        const y = Y / W;
        const z = Z / W;
        
        // Complete cheirality check - point should be in front of both cameras
        const point3D = new THREE.Vector3(x, y, z);
        
        // Check depth in camera 1 (world frame, z > 0)
        const depthCam1 = z;
        
        // Check depth in camera 2: (R*X + t).z > 0
        const Rcam2 = camera2.rotation;
        const tcam2 = camera2.translation;
        const pointCam2 = point3D.clone().applyMatrix3(Rcam2).add(tcam2);
        const depthCam2 = pointCam2.z;
        
        if (depthCam1 > 0 && depthCam2 > 0) {
          // Calculate reprojection error
          const reprojError = calculateReprojectionError(
            point3D,
            inlierMatches[i],
            camera1,
            camera2,
            intrinsics
          );
          
          if (reprojError < 2.0) { // 2 pixel threshold
            points3D.push({
              position: point3D,
              color: new THREE.Color(0.7 + Math.random() * 0.3, 0.7 + Math.random() * 0.3, 0.9),
              confidence: 1.0 - (reprojError / 2.0),
              reprojectionError: reprojError,
              viewCount: 2
            });
          }
        }
      }
    }
    
    // Cleanup
    I.delete();
    zeros.delete();
    Rt1.delete();
    P1.delete();
    Rt2.delete();
    P2.delete();
    inlierMat1.delete();
    inlierMat2.delete();
    points4D.delete();
    
  } catch (error) {
    console.error("OpenCV triangulation error:", error);
  }
  
  return points3D;
}

function calculateReprojectionError(
  point3D: THREE.Vector3,
  match: MatchedFeature,
  camera1: CameraPose,
  camera2: CameraPose,
  intrinsics: THREE.Matrix3
): number {
  
  // Project 3D point to camera 1
  const proj1 = projectPoint(point3D, camera1, intrinsics);
  const error1 = Math.sqrt(
    Math.pow(proj1.x - match.point1.x, 2) + 
    Math.pow(proj1.y - match.point1.y, 2)
  );
  
  // Project 3D point to camera 2
  const proj2 = projectPoint(point3D, camera2, intrinsics);
  const error2 = Math.sqrt(
    Math.pow(proj2.x - match.point2.x, 2) + 
    Math.pow(proj2.y - match.point2.y, 2)
  );
  
  return (error1 + error2) / 2;
}

function projectPoint(
  point3D: THREE.Vector3,
  camera: CameraPose,
  intrinsics: THREE.Matrix3
): { x: number; y: number } {
  
  // Transform to camera coordinates: X_c = R * (X - C)
  // where R is world-to-camera rotation and C is camera position
  const relativePoint = point3D.clone().sub(camera.position);
  const camPoint = relativePoint.applyMatrix3(camera.rotation);
  
  // Project using intrinsic matrix (THREE.Matrix3 is row-major)
  const fx = intrinsics.elements[0];
  const fy = intrinsics.elements[4];
  const cx = intrinsics.elements[2]; // Correct: cx is at elements[2] in row-major THREE.Matrix3
  const cy = intrinsics.elements[5]; // Correct: cy is at elements[5] in row-major THREE.Matrix3
  
  const x = (camPoint.x / camPoint.z) * fx + cx;
  const y = (camPoint.y / camPoint.z) * fy + cy;
  
  return { x, y };
}

function unprojectPoint(
  point: FeaturePoint,
  camera: CameraPose,
  intrinsics: THREE.Matrix3
): { origin: THREE.Vector3; direction: THREE.Vector3 } {
  
  // Convert image coordinates to normalized coordinates (THREE.Matrix3 is row-major)
  const fx = intrinsics.elements[0];
  const fy = intrinsics.elements[4];
  const cx = intrinsics.elements[2]; // Correct: cx is at elements[2] in row-major THREE.Matrix3
  const cy = intrinsics.elements[5]; // Correct: cy is at elements[5] in row-major THREE.Matrix3
  
  const x = (point.x - cx) / fx;
  const y = (point.y - cy) / fy;
  
  // Create ray in camera coordinate system
  const direction = new THREE.Vector3(x, y, 1).normalize();
  
  // Transform to world coordinates: R^T * direction for direction, camera.position for origin
  const worldDirection = direction.clone().applyMatrix3(camera.rotation.clone().transpose());
  const worldOrigin = camera.position.clone();
  
  return { origin: worldOrigin, direction: worldDirection };
}

async function generateMeshFromPointCloud(points3D: Point3D[]): Promise<Generated3DModel> {
  if (points3D.length === 0) {
    console.warn("No 3D points to generate mesh from");
    return createEmptyModel();
  }
  
  console.log(`Creating point cloud visualization from ${points3D.length} reconstructed points`);
  
  // Create vertices and colors arrays
  const vertices: number[] = [];
  const colors: number[] = [];
  
  for (const point of points3D) {
    vertices.push(point.position.x, point.position.y, point.position.z);
    colors.push(point.color.r, point.color.g, point.color.b);
  }
  
  // Create Three.js geometry for point cloud
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
  // Compute bounding sphere for better rendering
  geometry.computeBoundingSphere();
  
  // Create point material instead of mesh material
  const material = new THREE.PointsMaterial({
    size: 0.02,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8
  });
  
  // For now, don't create triangulated faces - just render as point cloud
  // This avoids artifacts from incorrect triangulation
  const faces = new Uint32Array(); // Empty faces array
  
  console.log("Point cloud model created successfully");
  
  return {
    geometry,
    material,
    vertices: new Float32Array(vertices),
    faces: faces
  };
}

function createFallbackModel(processedImages: ProcessedImage[]): Generated3DModel {
  console.log("Creating fallback model due to SfM failure");
  return createEmptyModel();
}

function createEmptyModel(): Generated3DModel {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
  
  const vertices = geometry.attributes.position.array as Float32Array;
  const faces = geometry.index?.array as Uint32Array || new Uint32Array();
  
  return {
    geometry,
    material,
    vertices,
    faces
  };
}

function cleanupOpenCVResources(imageFeatures: ImageFeatures[]) {
  for (const features of imageFeatures) {
    try {
      if (features.descriptors) features.descriptors.delete();
      if (features.keypoints) features.keypoints.delete();
      if (features.mat) features.mat.delete();
    } catch (error) {
      console.warn("Error cleaning up OpenCV resources:", error);
    }
  }
}