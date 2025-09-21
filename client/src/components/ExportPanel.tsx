import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useVision3D } from "../lib/stores/useVision3D";
import { exportToOBJ, exportToGLTF } from "../lib/objExporter";
import { Download, FileDown, Package } from "lucide-react";

export default function ExportPanel() {
  const { generatedModel } = useVision3D();
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'obj' | 'gltf'>('obj');

  const handleExport = async (format: 'obj' | 'gltf') => {
    if (!generatedModel) return;

    setIsExporting(true);
    
    try {
      let blob: Blob;
      let filename: string;

      if (format === 'obj') {
        const objData = exportToOBJ(generatedModel);
        blob = new Blob([objData], { type: 'text/plain' });
        filename = 'vision3d_model.obj';
      } else {
        const gltfData = exportToGLTF(generatedModel);
        blob = new Blob([JSON.stringify(gltfData, null, 2)], { type: 'application/json' });
        filename = 'vision3d_model.gltf';
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (!generatedModel) return;

    setIsExporting(true);
    
    try {
      // Create a zip-like structure by exporting multiple files
      await handleExport('obj');
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
      await handleExport('gltf');
    } finally {
      setIsExporting(false);
    }
  };

  if (!generatedModel) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-8 text-center">
        <FileDown className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400">No model available for export</p>
        <p className="text-sm text-gray-500 mt-2">
          Generate a 3D model first to enable export functionality
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export Options */}
      <Card className="bg-gray-800 border-gray-700 p-4">
        <h3 className="text-lg font-medium text-blue-400 mb-4">Export Options</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OBJ Export */}
          <Card className="bg-gray-900 border-gray-600 p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Package className="h-6 w-6 text-blue-400" />
              <div>
                <h4 className="font-medium text-gray-300">OBJ Format</h4>
                <p className="text-xs text-gray-500">Universal 3D format</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Wavefront OBJ format compatible with most 3D software including Blender, Maya, and 3ds Max.
            </p>
            <Button 
              onClick={() => handleExport('obj')}
              disabled={isExporting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download OBJ
            </Button>
          </Card>

          {/* GLTF Export */}
          <Card className="bg-gray-900 border-gray-600 p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Package className="h-6 w-6 text-green-400" />
              <div>
                <h4 className="font-medium text-gray-300">glTF Format</h4>
                <p className="text-xs text-gray-500">Modern web format</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              glTF 2.0 format optimized for web applications and real-time rendering engines.
            </p>
            <Button 
              onClick={() => handleExport('gltf')}
              disabled={isExporting}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download glTF
            </Button>
          </Card>
        </div>

        {/* Export All */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <Button 
            onClick={handleExportAll}
            disabled={isExporting}
            size="lg"
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export All Formats
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Model Information */}
      <Card className="bg-gray-800 border-gray-700 p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-3">Model Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Vertices:</span>
            <span className="text-gray-300 ml-2">
              {(generatedModel.vertices.length / 3).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Faces:</span>
            <span className="text-gray-300 ml-2">
              {(generatedModel.faces.length / 3).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Source Images:</span>
            <span className="text-gray-300 ml-2">
              {generatedModel.sourceImageCount || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Generated:</span>
            <span className="text-gray-300 ml-2">
              {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Usage Instructions */}
      <Card className="bg-gray-800 border-gray-700 p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2">Using Your 3D Model:</h3>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• <strong>Blender:</strong> File → Import → Wavefront (.obj)</li>
          <li>• <strong>Unity:</strong> Drag and drop into Assets folder</li>
          <li>• <strong>Three.js:</strong> Use OBJLoader or GLTFLoader</li>
          <li>• <strong>Web Viewers:</strong> Upload to Sketchfab or model-viewer</li>
          <li>• <strong>3D Printing:</strong> Import into Cura or PrusaSlicer</li>
        </ul>
      </Card>
    </div>
  );
}
