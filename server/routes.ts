import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { processImages } from "./services/imageProcessing";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // Maximum 50 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Image upload endpoint
  app.post("/api/upload-images", upload.array('images', 50), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "No images uploaded" });
      }

      const files = req.files as Express.Multer.File[];
      
      // Validate minimum number of images
      if (files.length < 3) {
        return res.status(400).json({ 
          error: "Minimum 3 images required for 3D reconstruction" 
        });
      }

      // Process images on the server
      const processedData = await processImages(files);

      res.json({
        message: "Images uploaded successfully",
        count: files.length,
        processedData
      });

    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ 
        error: "Failed to process uploaded images",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Vision3D API" });
  });

  // Model export endpoint
  app.post("/api/export-model", (req, res) => {
    try {
      const { format, modelData } = req.body;

      if (!format || !modelData) {
        return res.status(400).json({ error: "Format and model data are required" });
      }

      // In a real implementation, you might save the model to a file system
      // or cloud storage and return a download URL
      
      res.json({
        message: "Model export initiated",
        format,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Model export error:", error);
      res.status(500).json({ 
        error: "Failed to export model",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
