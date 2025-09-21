import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { useVision3D } from "../lib/stores/useVision3D.tsx";
import { removeBackground } from "../lib/backgroundRemoval.ts";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function ImageProcessor() {
  const { 
    images, 
    processedImages, 
    setProcessedImages, 
    isProcessing, 
    setIsProcessing,
    setCurrentStep 
  } = useVision3D();
  
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [processingErrors, setProcessingErrors] = useState<string[]>([]);

  const processImages = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setCurrentStep("Processing images and removing backgrounds...");
    setProgress(0);
    setProcessingErrors([]);
    
    const processed: { original: File; processed: string; success: boolean }[] = [];

    for (let i = 0; i < images.length; i++) {
      setCurrentImage(i + 1);
      setCurrentStep(`Processing image ${i + 1} of ${images.length}...`);
      
      try {
        // Convert File to ImageData for processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = URL.createObjectURL(images[i]);
        });

        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        
        if (imageData) {
          // Remove background
          const processedImageData = await removeBackground(imageData);
          
          // Convert back to data URL
          const processedCanvas = document.createElement('canvas');
          const processedCtx = processedCanvas.getContext('2d');
          processedCanvas.width = imageData.width;
          processedCanvas.height = imageData.height;
          processedCtx?.putImageData(processedImageData, 0, 0);
          
          const processedDataUrl = processedCanvas.toDataURL('image/png');
          
          processed.push({
            original: images[i],
            processed: processedDataUrl,
            success: true
          });
        } else {
          throw new Error('Failed to get image data');
        }
        
        // Clean up
        URL.revokeObjectURL(img.src);
        
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        setProcessingErrors(prev => [...prev, `Failed to process ${images[i].name}`]);
        
        // Still add the original image as fallback
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        try {
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = URL.createObjectURL(images[i]);
          });

          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          const originalDataUrl = canvas.toDataURL('image/png');
          
          processed.push({
            original: images[i],
            processed: originalDataUrl,
            success: false
          });
          
          URL.revokeObjectURL(img.src);
        } catch (fallbackError) {
          console.error('Failed to create fallback image:', fallbackError);
        }
      }
      
      setProgress((i + 1) / images.length * 100);
    }

    setProcessedImages(processed);
    setIsProcessing(false);
    setCurrentStep("Image processing complete!");
  };

  // Auto-start processing when images are available
  useEffect(() => {
    if (images.length > 0 && processedImages.length === 0 && !isProcessing) {
      processImages();
    }
  }, [images.length]);

  return (
    <div className="space-y-4">
      {/* Processing Status */}
      <Card className="bg-gray-800 border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {isProcessing ? (
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            ) : processedImages.length > 0 ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            )}
            <span className="font-medium text-gray-300">
              {isProcessing 
                ? `Processing Image ${currentImage} of ${images.length}`
                : processedImages.length > 0 
                  ? "Processing Complete" 
                  : "Ready to Process"
              }
            </span>
          </div>
          {!isProcessing && processedImages.length === 0 && (
            <Button 
              onClick={processImages}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={images.length === 0}
            >
              Start Processing
            </Button>
          )}
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-400">
              {progress.toFixed(1)}% complete
            </p>
          </div>
        )}

        {processingErrors.length > 0 && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-600 rounded">
            <h4 className="text-sm font-medium text-red-400 mb-2">Processing Warnings:</h4>
            <ul className="text-xs text-red-300 space-y-1">
              {processingErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Results Preview */}
      {processedImages.length > 0 && (
        <Card className="bg-gray-800 border-gray-700 p-4">
          <h3 className="text-lg font-medium text-blue-400 mb-4">
            Processed Images ({processedImages.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {processedImages.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden relative">
                  <img
                    src={item.processed}
                    alt={`Processed ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {!item.success && (
                    <div className="absolute top-1 right-1 bg-yellow-600 text-white text-xs px-1 py-0.5 rounded">
                      Original
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {item.original.name}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Processing Info */}
      <Card className="bg-gray-800 border-gray-700 p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2">Background Removal Process:</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Analyzing image content and detecting edges</li>
          <li>• Identifying foreground objects using color segmentation</li>
          <li>• Removing background while preserving object details</li>
          <li>• Converting to PNG format with transparency</li>
        </ul>
      </Card>
    </div>
  );
}
