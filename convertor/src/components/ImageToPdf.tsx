import React, { useState, useRef } from "react";
import jsPDF from "jspdf";

// Type for preview objects
type Preview = {
  name: string;
  url: string;
  file: File;
};

export default function ImageToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: File[]) => {
    const chosen = files.filter(file => file.type === "image/jpeg" || file.type === "image/png");
    setFiles(chosen);

    // Create previews
    const p: Preview[] = chosen.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
      file: f,
    }));
    setPreviews(p);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files || []);
    handleFiles(chosen);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const clear = () => {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setFiles([]);
    setPreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Utility: load file as data URL
  const fileToDataURL = (file: File): Promise<string | ArrayBuffer | null> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result ?? null);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const generatePDF = async () => {
    if (!files.length) {
      alert("Please select one or more image files (jpg/png).");
      return;
    }

    setIsConverting(true);
    
    try {
      // A4 dimensions in mm
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = (await fileToDataURL(file)) as string;

        // Create an Image to get its natural size
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = dataUrl;
        });

        // Calculate dimensions to fit the A4 page while preserving aspect ratio
        const imgWidthPx = img.naturalWidth;
        const imgHeightPx = img.naturalHeight;

        // Assume 96 DPI for pixel->mm conversion: 1px = 25.4/96 mm
        const pxToMm = 25.4 / 96;
        let imgWmm = imgWidthPx * pxToMm;
        let imgHmm = imgHeightPx * pxToMm;

        const maxW = pageWidth - 20; // margin
        const maxH = pageHeight - 20;

        const widthRatio = maxW / imgWmm;
        const heightRatio = maxH / imgHmm;
        const ratio = Math.min(widthRatio, heightRatio, 1);

        const finalW = imgWmm * ratio;
        const finalH = imgHmm * ratio;

        const x = (pageWidth - finalW) / 2; // center horizontally
        const y = (pageHeight - finalH) / 2; // center vertically

        if (i > 0) pdf.addPage();

        const type = file.type === "image/png" ? "PNG" : "JPEG";
        pdf.addImage(dataUrl, type, x, y, finalW, finalH);
      }

      // Add a small delay to show the animation
      setTimeout(() => {
        pdf.save("images-to-pdf.pdf");
        setIsConverting(false);
      }, 800);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setIsConverting(false);
      alert("An error occurred while generating the PDF. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-indigo-700 mb-2">Image to PDF Converter</h1>
            <p className="text-gray-600">Convert your images to a beautiful PDF document</p>
          </div>

          {/* File Upload Area */}
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 mb-8 
              ${isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'} 
              ${previews.length > 0 ? 'hidden' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Drag & Drop your images here</h3>
              <p className="text-sm text-gray-500 mb-4">Supports JPG and PNG images</p>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Select Images
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </div>

          {/* Preview Section */}
          {previews.length > 0 && (
            <div className="mb-8 transition-all duration-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Selected Images ({previews.length})</h3>
                <button 
                  onClick={clear}
                  className="text-sm text-red-500 hover:text-red-700 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear All
                </button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {previews.map((p, idx) => (
                  <div 
                    key={idx} 
                    className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 relative group"
                  >
                    <div className="h-32 bg-gray-100 flex items-center justify-center">
                      <img
                        src={p.url}
                        alt={p.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-gray-700 truncate">{p.name}</p>
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button 
                        onClick={() => {
                          const newPreviews = previews.filter((_, i) => i !== idx);
                          const newFiles = files.filter((_, i) => i !== idx);
                          setPreviews(newPreviews);
                          setFiles(newFiles);
                        }}
                        className="text-white p-1 rounded-full bg-red-500 hover:bg-red-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {previews.length > 0 && (
              <>
                <button
                  onClick={generatePDF}
                  disabled={isConverting}
                  className={`px-6 py-3 rounded-lg text-white font-medium flex items-center justify-center transition-all duration-300
                    ${isConverting 
                      ? 'bg-indigo-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow hover:shadow-md'}`}
                >
                  {isConverting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Converting...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      Generate PDF
                    </>
                  )}
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium flex items-center justify-center transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add More Images
                </button>
              </>
            )}
          </div>

          {/* Info Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Note:</span> This is a client-side converter. For large images or many pages, 
                  consider server-side conversion to avoid memory issues. All processing happens in your browser.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}