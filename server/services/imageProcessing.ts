import sharp from 'sharp';

export interface ProcessedImageData {
  originalName: string;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  hasAlpha: boolean;
}

export async function processImages(files: Express.Multer.File[]): Promise<ProcessedImageData[]> {
  const processedData: ProcessedImageData[] = [];

  for (const file of files) {
    try {
      // Get image metadata using Sharp
      const metadata = await sharp(file.buffer).metadata();
      
      const imageData: ProcessedImageData = {
        originalName: file.originalname,
        size: file.size,
        dimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0
        },
        format: metadata.format || 'unknown',
        hasAlpha: metadata.hasAlpha || false
      };

      processedData.push(imageData);

    } catch (error) {
      console.error(`Error processing image ${file.originalname}:`, error);
      // Continue processing other images even if one fails
    }
  }

  return processedData;
}

export async function resizeImage(
  buffer: Buffer, 
  maxWidth: number = 1920, 
  maxHeight: number = 1080
): Promise<Buffer> {
  return await sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function extractImageFeatures(buffer: Buffer): Promise<{
  brightness: number;
  contrast: number;
  sharpness: number;
}> {
  // Get image statistics
  const { data, info } = await sharp(buffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate basic image quality metrics
  const pixels = new Uint8Array(data);
  const sum = pixels.reduce((acc, val) => acc + val, 0);
  const brightness = sum / (pixels.length * 255);
  
  const mean = sum / pixels.length;
  const variance = pixels.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / pixels.length;
  const contrast = Math.sqrt(variance) / 255;
  
  // Simple sharpness estimation (would be more complex in real implementation)
  const sharpness = contrast; // Simplified metric

  return {
    brightness,
    contrast,
    sharpness
  };
}
