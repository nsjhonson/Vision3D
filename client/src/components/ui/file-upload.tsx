import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "../../lib/utils";
import { Upload, X, File } from "lucide-react";
import { Button } from "./button";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  onFilesChange,
  accept = { 'image/*': ['.jpeg', '.jpg', '.png', '.bmp', '.webp'] },
  multiple = true,
  maxFiles = 50,
  maxSize = 10 * 1024 * 1024, // 10MB
  className,
  disabled = false
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ [key: string]: string }>({});

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles);
    setFiles(newFiles);
    onFilesChange(newFiles);

    // Create previews for image files
    const newPreviews: { [key: string]: string } = {};
    acceptedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newPreviews[file.name] = url;
      }
    });
    setPreviews(prev => ({ ...prev, ...newPreviews }));

    // Log rejected files
    if (rejectedFiles.length > 0) {
      console.warn('Rejected files:', rejectedFiles);
    }
  }, [files, maxFiles, onFilesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
    maxFiles,
    maxSize,
    disabled
  });

  const removeFile = (index: number) => {
    const file = files[index];
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);

    // Clean up preview URL
    if (previews[file.name]) {
      URL.revokeObjectURL(previews[file.name]);
      setPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[file.name];
        return newPreviews;
      });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors",
          isDragActive
            ? "border-blue-400 bg-blue-950/20"
            : "border-gray-600 bg-gray-800 hover:border-gray-500",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          <Upload className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-300">
            {isDragActive
              ? "Drop files here..."
              : "Drag & drop files here, or click to select"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Max {maxFiles} files, {Math.round(maxSize / 1024 / 1024)}MB each
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFiles([]);
                onFilesChange([]);
                // Clean up all previews
                Object.values(previews).forEach(url => URL.revokeObjectURL(url));
                setPreviews({});
              }}
            >
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {files.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square bg-gray-800 rounded border border-gray-700 overflow-hidden">
                  {previews[file.name] ? (
                    <img
                      src={previews[file.name]}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <File className="h-6 w-6 text-gray-500" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
