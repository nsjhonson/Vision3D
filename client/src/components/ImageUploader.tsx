import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useVision3D } from "../lib/stores/useVision3D";
import { Upload, X, Image as ImageIcon } from "lucide-react";

export default function ImageUploader() {
  const { images, addImages, removeImage } = useVision3D();
  const [previews, setPreviews] = useState<{ [key: string]: string }>({});

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter(file => 
      file.type.startsWith('image/')
    );

    // Create previews
    const newPreviews: { [key: string]: string } = {};
    imageFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      newPreviews[file.name] = url;
    });

    setPreviews(prev => ({ ...prev, ...newPreviews }));
    addImages(imageFiles);
  }, [addImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.bmp', '.webp']
    },
    multiple: true
  });

  const handleRemoveImage = (index: number) => {
    const image = images[index];
    if (previews[image.name]) {
      URL.revokeObjectURL(previews[image.name]);
      setPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[image.name];
        return newPreviews;
      });
    }
    removeImage(index);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card 
        {...getRootProps()} 
        className={`
          border-2 border-dashed p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-blue-400 bg-blue-900/20' 
            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-4">
          <Upload className="h-12 w-12 text-gray-400" />
          <div>
            <p className="text-lg font-medium text-gray-300">
              {isDragActive 
                ? "Drop images here..." 
                : "Drag & drop images here, or click to select"
              }
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Upload 15+ images from different angles for best results
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Supports: JPEG, PNG, BMP, WebP
            </p>
          </div>
          <Button 
            type="button" 
            className="bg-blue-600 hover:bg-blue-700"
          >
            Select Images
          </Button>
        </div>
      </Card>

      {/* Image Count and Status */}
      {images.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
          <div className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5 text-blue-400" />
            <span className="text-gray-300">
              {images.length} image{images.length !== 1 ? 's' : ''} uploaded
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {images.length >= 15 
              ? "✓ Good coverage for 3D reconstruction" 
              : `Upload ${15 - images.length} more for optimal results`
            }
          </div>
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden">
                {previews[image.name] ? (
                  <img
                    src={previews[image.name]}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-gray-500" />
                  </div>
                )}
              </div>
              <button
                onClick={() => handleRemoveImage(index)}
                className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mt-1 text-xs text-gray-500 truncate">
                {image.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <Card className="bg-gray-800 border-gray-700 p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2">Tips for Best Results:</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Take photos from all angles around the object</li>
          <li>• Ensure good lighting and sharp focus</li>
          <li>• Include overlap between consecutive photos</li>
          <li>• Use a plain background if possible</li>
          <li>• Keep the object centered in each photo</li>
        </ul>
      </Card>
    </div>
  );
}
