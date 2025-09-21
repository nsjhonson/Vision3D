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
  const { stats } = await sharp(buffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate basic image quality metrics
  const brightness = stats ? (stats.mean || [0])[0] / 255 : 0;
  const contrast = stats ? Math.sqrt((stats.variance || [0])[0]) / 255 : 0;
  
  // Simple sharpness estimation (would be more complex in real implementation)
  const sharpness = contrast; // Simplified metric

  return {
    brightness,
    contrast,
    sharpness
  };
}
