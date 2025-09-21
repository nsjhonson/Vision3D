export async function removeBackground(imageData: ImageData): Promise<ImageData> {
  const { data, width, height } = imageData;
  const outputData = new Uint8ClampedArray(data);
  
  // Simple background removal using edge detection and color segmentation
  // This is a basic implementation - in production, you'd use more sophisticated ML models
  
  // Step 1: Convert to grayscale for edge detection
  const grayscale = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    grayscale[i / 4] = gray;
  }
  
  // Step 2: Apply Sobel edge detection
  const edges = new Uint8ClampedArray(width * height);
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += grayscale[idx] * sobelX[kernelIdx];
          gy += grayscale[idx] * sobelY[kernelIdx];
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }
  
  // Step 3: Find background regions using flood fill from corners
  const background = new Uint8ClampedArray(width * height);
  const visited = new Uint8ClampedArray(width * height);
  
  // Flood fill from corners to identify background
  const queue: [number, number][] = [];
  const startPoints = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]
  ];
  
  startPoints.forEach(([x, y]) => {
    if (!visited[y * width + x]) {
      queue.push([x, y]);
      floodFill(x, y, grayscale, background, visited, width, height, queue);
    }
  });
  
  // Step 4: Apply background removal with edge preservation
  for (let i = 0; i < data.length; i += 4) {
    const pixelIdx = i / 4;
    const x = pixelIdx % width;
    const y = Math.floor(pixelIdx / width);
    
    // Check if pixel is background or has weak edges
    const isBackground = background[pixelIdx] > 0;
    const hasWeakEdge = edges[pixelIdx] < 30;
    
    if (isBackground && hasWeakEdge) {
      // Make transparent
      outputData[i + 3] = 0;
    } else if (isBackground && edges[pixelIdx] < 100) {
      // Partially transparent for smooth edges
      outputData[i + 3] = Math.max(0, outputData[i + 3] - 150);
    }
    // Otherwise keep original alpha
  }
  
  return new ImageData(outputData, width, height);
}

function floodFill(
  startX: number, 
  startY: number, 
  grayscale: Uint8ClampedArray, 
  background: Uint8ClampedArray, 
  visited: Uint8ClampedArray, 
  width: number, 
  height: number,
  queue: [number, number][]
) {
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const idx = y * width + x;
    if (visited[idx]) continue;
    
    visited[idx] = 1;
    background[idx] = 1;
    
    const currentGray = grayscale[idx];
    
    // Check 4-connected neighbors
    const neighbors = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
    ];
    
    neighbors.forEach(([nx, ny]) => {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!visited[nIdx]) {
          const neighborGray = grayscale[nIdx];
          // Continue flood fill if colors are similar (background region)
          if (Math.abs(currentGray - neighborGray) < 40) {
            queue.push([nx, ny]);
          }
        }
      }
    });
  }
}

// Advanced color-based segmentation helper
export function segmentByColor(imageData: ImageData, seedPoints: [number, number][]): ImageData {
  const { data, width, height } = imageData;
  const mask = new Uint8ClampedArray(width * height);
  
  // For each seed point, grow region based on color similarity
  seedPoints.forEach(([seedX, seedY]) => {
    const seedIdx = (seedY * width + seedX) * 4;
    const seedR = data[seedIdx];
    const seedG = data[seedIdx + 1];
    const seedB = data[seedIdx + 2];
    
    const queue: [number, number][] = [[seedX, seedY]];
    const visited = new Uint8ClampedArray(width * height);
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = y * width + x;
      if (visited[idx] || mask[idx]) continue;
      
      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      
      // Color distance threshold
      const colorDistance = Math.sqrt(
        Math.pow(r - seedR, 2) + 
        Math.pow(g - seedG, 2) + 
        Math.pow(b - seedB, 2)
      );
      
      if (colorDistance < 50) { // Threshold for color similarity
        visited[idx] = 1;
        mask[idx] = 1;
        
        // Add neighbors to queue
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
  });
  
  // Apply mask to create output image
  const outputData = new Uint8ClampedArray(data);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      outputData[i * 4 + 3] = 0; // Make transparent
    }
  }
  
  return new ImageData(outputData, width, height);
}
