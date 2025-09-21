import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { BufferGeometry, Material } from "three";

export interface ProcessedImage {
  original: File;
  processed: string; // Data URL
  success: boolean;
}

export interface Generated3DModel {
  geometry: BufferGeometry;
  material: Material;
  vertices: Float32Array;
  faces: Uint32Array;
  sourceImageCount?: number;
}

interface Vision3DState {
  // Images
  images: File[];
  processedImages: ProcessedImage[];
  
  // 3D Model
  generatedModel: Generated3DModel | null;
  
  // Processing states
  isProcessing: boolean;
  isGenerating: boolean;
  currentStep: string;
  
  // Actions
  addImages: (newImages: File[]) => void;
  removeImage: (index: number) => void;
  setProcessedImages: (images: ProcessedImage[]) => void;
  setGeneratedModel: (model: Generated3DModel | null) => void;
  setIsProcessing: (processing: boolean) => void;
  setIsGenerating: (generating: boolean) => void;
  setCurrentStep: (step: string) => void;
  reset: () => void;
}

export const useVision3D = create<Vision3DState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    images: [],
    processedImages: [],
    generatedModel: null,
    isProcessing: false,
    isGenerating: false,
    currentStep: "",
    
    // Actions
    addImages: (newImages) => {
      set((state) => ({
        images: [...state.images, ...newImages]
      }));
    },
    
    removeImage: (index) => {
      set((state) => ({
        images: state.images.filter((_, i) => i !== index)
      }));
    },
    
    setProcessedImages: (images) => {
      set({ processedImages: images });
    },
    
    setGeneratedModel: (model) => {
      set({ generatedModel: model });
    },
    
    setIsProcessing: (processing) => {
      set({ isProcessing: processing });
    },
    
    setIsGenerating: (generating) => {
      set({ isGenerating: generating });
    },
    
    setCurrentStep: (step) => {
      set({ currentStep: step });
    },
    
    reset: () => {
      set({
        images: [],
        processedImages: [],
        generatedModel: null,
        isProcessing: false,
        isGenerating: false,
        currentStep: "",
      });
    }
  }))
);
