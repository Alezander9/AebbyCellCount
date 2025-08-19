"use client";


import { useState } from "react";

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

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setUploadedImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
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
        <h2 className="text-lg font-semibold mb-4">Upload Image</h2>
        <div 
          className="flex-1 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          {uploadedImage ? (
            <img 
              src={uploadedImage} 
              alt="Uploaded" 
              className="max-w-full max-h-full object-contain rounded-lg"
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
              </p>
            </div>
          )}
        </div>
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
        <h2 className="text-lg font-semibold mb-4">Annotated Image</h2>
        <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
          <p className="text-slate-600 dark:text-slate-400">
            annotated image will be put here soon
          </p>
        </div>
      </div>
    </div>
  );
}


