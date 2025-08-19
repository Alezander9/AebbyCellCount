"use client";


import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-light dark:bg-dark p-4 border-b-2 border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold text-center">Aebby Cell Counter</h1>
      </header>
      <main className="p-8">
        <Content />
      </main>
    </>
  );
}



function Content() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [cellCount, setCellCount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [targetColor, setTargetColor] = useState<string>("#FF2600"); // Default red color

  // Convex actions
  const processCellImageAction = useAction(api.actions.daytona.processCellImage);
  const processCellImageFromStorageAction = useAction(api.actions.daytona.processCellImageFromStorage);
  const generateUploadUrlMutation = useMutation(api.mutations.files.generateUploadUrl);





  // Helper function to convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 38, b: 0 }; // fallback to default red
  };

  const handleImageUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        const imageData = e.target.result as string;
        setUploadedImage(imageData);
        
        // Reset previous results
        setAnnotatedImage(null);
        setCellCount(null);
        setError(null);
        setProcessingStatus("");
        
        // Automatically start processing the image
        await processImage(imageData);
      }
    };
    reader.readAsDataURL(file);
  };

  // Function to process image data
  const processImage = async (imageData: string) => {
    console.log("=== PROCESSING UPLOADED IMAGE ===");
    console.log("[TEMPLOG] Image data length:", imageData.length);
    console.log("[TEMPLOG] Image data prefix:", imageData.substring(0, 100));
    console.log("[TEMPLOG] Image data contains comma:", imageData.includes(','));
    console.log("[TEMPLOG] Image data MIME type:", imageData.split(',')[0]);
    setIsProcessing(true);
    
    // Check if we need to use file storage (Node.js actions have 5MB limit)
    const nodejsActionLimit = 4 * 1024 * 1024; // 4MB to stay under 5MB limit
    console.log("[TEMPLOG] Size check - Current:", imageData.length, "bytes, Limit:", nodejsActionLimit, "bytes");
    console.log("[TEMPLOG] Needs file storage:", imageData.length > nodejsActionLimit);
    
    try {
      let result;
      
      if (imageData.length > nodejsActionLimit) {
        console.log("[TEMPLOG] Using file storage approach for large image...");
        setProcessingStatus("Large image detected, uploading to storage...");
        
        // Step 1: Get upload URL
        console.log("[TEMPLOG] Generating upload URL...");
        const uploadUrl = await generateUploadUrlMutation();
        
        // Step 2: Convert base64 to blob and upload
        console.log("[TEMPLOG] Converting to blob and uploading...");
        const base64Data = imageData.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        
        console.log("[TEMPLOG] Blob size:", blob.size, "bytes");
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: blob,
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }
        
        const uploadResult = await uploadResponse.json();
        const storageId = uploadResult.storageId;
        console.log("[TEMPLOG] File uploaded successfully, storage ID:", storageId);
        
        setProcessingStatus("Processing large image...");
        
        // Step 3: Process using storage
        console.log("[TEMPLOG] Calling processCellImageFromStorageAction with storage ID:", storageId);
        const rgbColor = hexToRgb(targetColor);
        console.log("[TEMPLOG] Using target color:", rgbColor, "from hex:", targetColor);
        result = await processCellImageFromStorageAction({
          storageId,
          targetColor: rgbColor
        });
        
      } else {
        console.log("[TEMPLOG] Using direct approach for small image...");
        setProcessingStatus("Analyzing cells...");
        
        const rgbColor = hexToRgb(targetColor);
        console.log("[TEMPLOG] Calling processCellImageAction with:", {
          imageBase64Length: imageData.length,
          targetColor: rgbColor
        });
        console.log("[TEMPLOG] Using target color:", rgbColor, "from hex:", targetColor);
        
        result = await processCellImageAction({
          imageBase64: imageData,
          targetColor: rgbColor
        });
      }
      
      console.log("[TEMPLOG] Raw result from action:", result);
      console.log("Image processing result:", result);
      
      if (result.success) {
        console.log("SUCCESS! Found", result.cell_count, "cells");
        console.log("Cell locations:", result.cell_locations);
        if (result.annotated_image_base64) {
          setAnnotatedImage(`data:image/png;base64,${result.annotated_image_base64}`);
        }
        setCellCount(result.cell_count || 0);
      } else {
        console.error("Image processing failed:", result.error);
        setError(result.error || "Failed to process image");
      }
    } catch (error) {
      console.error("Error processing image:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred")
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
    
    console.log("=== IMAGE PROCESSING COMPLETE ===");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      handleImageUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  return (
    <div className="flex gap-8 h-[calc(100vh-120px)]">
      {/* Left Panel - Image Upload */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upload Image</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="color-picker" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Target Color:
            </label>
            <input
              id="color-picker"
              type="color"
              value={targetColor}
              onChange={(e) => setTargetColor(e.target.value)}
              className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
              title="Select the color of cells to detect"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {targetColor.toUpperCase()}
            </span>
          </div>
        </div>
        <div 
          className="flex-1 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors overflow-hidden"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          {uploadedImage ? (
            <img 
              src={uploadedImage} 
              alt="Uploaded" 
              className="max-w-full max-h-full object-contain rounded-lg"
              style={{ maxHeight: '100%', maxWidth: '100%' }}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-blue-600 dark:text-blue-400">
              <svg 
                className="w-16 h-16" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-center">
                <span className="font-medium">Click to upload</span> or drag and drop
                <br />
                <span className="text-sm opacity-75">PNG, JPG, JPEG files</span>
                <br />
                <span className="text-xs opacity-60 mt-2 block">Images will be processed automatically</span>
              </p>
            </div>
          )}
        </div>
        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-red-800 dark:text-red-200 text-sm">
              <span className="font-medium">Error:</span> {error}
            </p>
          </div>
        )}
        <input
          id="file-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Right Panel - Annotated Image */}
      <div className="w-1/2 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Annotated Image</h2>
          {cellCount !== null && (
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Cells: {cellCount}
            </span>
          )}
        </div>
        <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
          {annotatedImage ? (
            <img 
              src={annotatedImage} 
              alt="Annotated with cell count" 
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          ) : error ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Failed to process image
              </p>
            </div>
          ) : isProcessing ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                {processingStatus || "Analyzing cells..."}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400">
                Upload an image to see annotated results
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


