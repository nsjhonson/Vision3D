import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import ImageUploader from "./ImageUploader.tsx";
import ImageProcessor from "./ImageProcessor.tsx";
import ModelViewer from "./ModelViewer.tsx";
import ModelGenerator from "./ModelGenerator.tsx";
import ExportPanel from "./ExportPanel.tsx";
import { useVision3D } from "../lib/stores/useVision3D.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export default function Vision3D() {
  const { 
    images, 
    processedImages, 
    generatedModel, 
    isProcessing, 
    isGenerating,
    currentStep,
    reset 
  } = useVision3D();

  const [activeTab, setActiveTab] = useState("upload");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-blue-400">Vision3D</h1>
            <div className="text-sm text-gray-300">
              Convert 2D Images to Interactive 3D Models
            </div>
            <Button 
              onClick={reset} 
              variant="outline" 
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Reset Project
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-gray-800 border-gray-700">
            <TabsTrigger value="upload" className="text-gray-300 data-[state=active]:bg-blue-600">
              1. Upload
            </TabsTrigger>
            <TabsTrigger 
              value="process" 
              className="text-gray-300 data-[state=active]:bg-blue-600"
              disabled={images.length === 0}
            >
              2. Process
            </TabsTrigger>
            <TabsTrigger 
              value="generate" 
              className="text-gray-300 data-[state=active]:bg-blue-600"
              disabled={processedImages.length === 0}
            >
              3. Generate
            </TabsTrigger>
            <TabsTrigger 
              value="view" 
              className="text-gray-300 data-[state=active]:bg-blue-600"
              disabled={!generatedModel}
            >
              4. View
            </TabsTrigger>
            <TabsTrigger 
              value="export" 
              className="text-gray-300 data-[state=active]:bg-blue-600"
              disabled={!generatedModel}
            >
              5. Export
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="upload" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-blue-400">Upload Images</CardTitle>
                  <p className="text-gray-300 text-sm">
                    Upload 15+ images of your object from different angles for best results
                  </p>
                </CardHeader>
                <CardContent>
                  <ImageUploader />
                  {images.length > 0 && (
                    <div className="mt-4">
                      <Button 
                        onClick={() => setActiveTab("process")}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Proceed to Processing ({images.length} images)
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="process" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-blue-400">Process Images</CardTitle>
                  <p className="text-gray-300 text-sm">
                    Remove backgrounds and prepare images for 3D reconstruction
                  </p>
                </CardHeader>
                <CardContent>
                  <ImageProcessor />
                  {processedImages.length > 0 && !isProcessing && (
                    <div className="mt-4">
                      <Button 
                        onClick={() => setActiveTab("generate")}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Proceed to 3D Generation
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="generate" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-blue-400">Generate 3D Model</CardTitle>
                  <p className="text-gray-300 text-sm">
                    Create 3D model using photogrammetry techniques
                  </p>
                </CardHeader>
                <CardContent>
                  <ModelGenerator />
                  {generatedModel && !isGenerating && (
                    <div className="mt-4">
                      <Button 
                        onClick={() => setActiveTab("view")}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        View 3D Model
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="view" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-blue-400">Interactive 3D Viewer</CardTitle>
                  <p className="text-gray-300 text-sm">
                    Rotate, zoom, and pan to explore your 3D model
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-96 bg-gray-900 rounded-lg overflow-hidden">
                    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                      <color attach="background" args={["#111111"]} />
                      <ambientLight intensity={0.4} />
                      <directionalLight position={[10, 10, 5]} intensity={1} />
                      <OrbitControls enablePan enableZoom enableRotate />
                      <Environment preset="studio" />
                      {generatedModel && <ModelViewer model={generatedModel} />}
                    </Canvas>
                  </div>
                  <div className="mt-4">
                    <Button 
                      onClick={() => setActiveTab("export")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Export Model
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-blue-400">Export Model</CardTitle>
                  <p className="text-gray-300 text-sm">
                    Download your 3D model in .obj format
                  </p>
                </CardHeader>
                <CardContent>
                  <ExportPanel />
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Status Display */}
        {(isProcessing || isGenerating) && (
          <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
              <div className="text-sm text-gray-300">
                {currentStep}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
