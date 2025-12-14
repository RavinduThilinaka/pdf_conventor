import React, { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";

// Type for preview objects
type Preview = {
  name: string;
  url: string;
  file: File;
  id: string;
};

type PageSize = "a4" | "letter" | "legal" | "a3";
type PageOrientation = "portrait" | "landscape";
type ImageSize = "fit" | "fill" | "original";

export default function ImageToPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<PageOrientation>("portrait");
  const [imageSize, setImageSize] = useState<ImageSize>("fit");
  const [margin, setMargin] = useState<number>(10);
  const [quality, setQuality] = useState<number>(1);
  const [fileName, setFileName] = useState<string>("images-to-pdf");
  const [selectedPreview, setSelectedPreview] = useState<number | null>(null);
  const [totalSize, setTotalSize] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showSettings, setShowSettings] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate total size when files change
  useEffect(() => {
    const size = files.reduce((acc, file) => acc + file.size, 0);
    setTotalSize(size);
  }, [files]);

  const handleFiles = (files: File[]) => {
    setIsLoading(true);
    
    // Simulate loading for better UX
    setTimeout(() => {
      const chosen = files.filter(file => 
        file.type === "image/jpeg" || 
        file.type === "image/png" ||
        file.type === "image/webp" ||
        file.type === "image/gif"
      );
      
      // Add new files to existing ones
      setFiles(prev => [...prev, ...chosen]);

      // Create previews for new files
      const newPreviews: Preview[] = chosen.map((f) => ({
        name: f.name,
        url: URL.createObjectURL(f),
        file: f,
        id: Math.random().toString(36).substr(2, 9),
      }));
      
      setPreviews(prev => [...prev, ...newPreviews]);
      setIsLoading(false);
    }, 500);
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

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Reorder images
  const reorderImages = (fromIndex: number, toIndex: number) => {
    const newPreviews = [...previews];
    const [moved] = newPreviews.splice(fromIndex, 1);
    newPreviews.splice(toIndex, 0, moved);
    
    const newFiles = [...files];
    const [movedFile] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, movedFile);
    
    setPreviews(newPreviews);
    setFiles(newFiles);
  };

  // Sort images by name
  const sortImages = () => {
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newOrder);
    
    const sortedPreviews = [...previews].sort((a, b) => {
      return newOrder === "asc" 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    });
    
    const sortedFiles = sortedPreviews.map(p => p.file);
    
    setPreviews(sortedPreviews);
    setFiles(sortedFiles);
  };

  const generatePDF = async () => {
    if (!files.length) {
      alert("Please select one or more image files.");
      return;
    }

    setIsConverting(true);
    setProgress(0);
    
    try {
      // Get page dimensions based on settings
      const pageDimensions: Record<PageSize, { width: number; height: number }> = {
        a4: { width: 210, height: 297 },
        letter: { width: 215.9, height: 279.4 },
        legal: { width: 215.9, height: 355.6 },
        a3: { width: 297, height: 420 }
      };

      const dimensions = pageDimensions[pageSize];
      const isLandscape = orientation === "landscape";
      const pageWidth = isLandscape ? dimensions.height : dimensions.width;
      const pageHeight = isLandscape ? dimensions.width : dimensions.height;

      const pdf = new jsPDF({ 
        unit: "mm", 
        format: [pageWidth, pageHeight],
        orientation: isLandscape ? "landscape" : "portrait"
      });

      const maxW = pageWidth - (margin * 2);
      const maxH = pageHeight - (margin * 2);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = (await fileToDataURL(file)) as string;

        // Update progress
        setProgress(Math.round(((i + 1) / files.length) * 100));

        // Create an Image to get its natural size
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
          img.src = dataUrl;
        });

        const imgWidthPx = img.naturalWidth;
        const imgHeightPx = img.naturalHeight;

        // Convert pixels to mm (assume 96 DPI)
        const pxToMm = 25.4 / 96;
        let imgWmm = imgWidthPx * pxToMm;
        let imgHmm = imgHeightPx * pxToMm;

        let finalW = imgWmm;
        let finalH = imgHmm;
        let x = margin;
        let y = margin;

        switch (imageSize) {
          case "fit":
            const widthRatio = maxW / imgWmm;
            const heightRatio = maxH / imgHmm;
            const ratio = Math.min(widthRatio, heightRatio, 1);
            
            finalW = imgWmm * ratio;
            finalH = imgHmm * ratio;
            x = (pageWidth - finalW) / 2;
            y = (pageHeight - finalH) / 2;
            break;

          case "fill":
            const fillRatio = Math.max(maxW / imgWmm, maxH / imgHmm);
            finalW = imgWmm * fillRatio;
            finalH = imgHmm * fillRatio;
            x = (pageWidth - finalW) / 2;
            y = (pageHeight - finalH) / 2;
            break;

          case "original":
            // Keep original size, but ensure it fits on page
            if (finalW > maxW || finalH > maxH) {
              const ratio = Math.min(maxW / finalW, maxH / finalH, 1);
              finalW *= ratio;
              finalH *= ratio;
            }
            x = (pageWidth - finalW) / 2;
            y = (pageHeight - finalH) / 2;
            break;
        }

        if (i > 0) pdf.addPage();

        const type = file.type.includes("png") ? "PNG" : 
                    file.type.includes("webp") ? "WEBP" : "JPEG";
        
        // Fixed: Use correct parameters for addImage
        pdf.addImage(dataUrl, type, x, y, finalW, finalH);
      }

      // Add a small delay to show the animation
      setTimeout(() => {
        pdf.save(`${fileName}.pdf`);
        setIsConverting(false);
        setProgress(0);
      }, 800);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setIsConverting(false);
      setProgress(0);
      alert("An error occurred while generating the PDF. Please try again.");
    }
  };

  // Preview image in modal
  const openPreview = (index: number) => {
    setSelectedPreview(index);
  };

  const closePreview = () => {
    setSelectedPreview(null);
  };

  const navigatePreview = (direction: "prev" | "next") => {
    if (selectedPreview === null) return;
    
    const newIndex = direction === "prev" 
      ? selectedPreview - 1 
      : selectedPreview + 1;
    
    if (newIndex >= 0 && newIndex < previews.length) {
      setSelectedPreview(newIndex);
    }
  };

  // Remove single image
  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index].url);
    const newPreviews = previews.filter((_, i) => i !== index);
    const newFiles = files.filter((_, i) => i !== index);
    setPreviews(newPreviews);
    setFiles(newFiles);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-6xl mx-auto relative">
        {/* Header with Glass Effect */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-pink-300">
            Image to PDF Converter
          </h1>
          <p className="text-lg text-purple-200 opacity-90 max-w-2xl mx-auto">
            Transform your images into a beautifully formatted PDF document with professional quality
          </p>
        </div>

        {/* Main Card with Glass Effect */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          <div className="p-8">
            {/* Stats Bar */}
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-2xl p-6 mb-8 border border-white/10 shadow-inner">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="flex flex-wrap gap-6 mb-4 md:mb-0">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-purple-200">Images</p>
                      <p className="text-2xl font-bold text-white">{files.length}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-blue-200">Total Size</p>
                      <p className="text-2xl font-bold text-white">{formatFileSize(totalSize)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-pink-500/20 rounded-lg">
                      <svg className="w-5 h-5 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-pink-200">Page Size</p>
                      <p className="text-2xl font-bold text-white">{pageSize.toUpperCase()}</p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center space-x-2 group"
                >
                  <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{showSettings ? "Hide Settings" : "Show Settings"}</span>
                </button>
              </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="bg-gradient-to-br from-gray-900/40 to-gray-800/40 rounded-2xl p-8 mb-8 border border-white/10 shadow-xl backdrop-blur-sm animate-fadeIn">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-white flex items-center space-x-3">
                    <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span>PDF Settings</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="text-sm text-green-300">Active</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Setting Cards */}
                  {[
                    {
                      label: "Page Size",
                      value: pageSize,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setPageSize(e.target.value as PageSize),
                      options: [
                        { value: "a4", label: "A4 (210 × 297mm)" },
                        { value: "letter", label: "Letter (216 × 279mm)" },
                        { value: "legal", label: "Legal (216 × 356mm)" },
                        { value: "a3", label: "A3 (297 × 420mm)" }
                      ],
                      icon: "📄"
                    },
                    {
                      label: "Orientation",
                      value: orientation,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setOrientation(e.target.value as PageOrientation),
                      options: [
                        { value: "portrait", label: "Portrait" },
                        { value: "landscape", label: "Landscape" }
                      ],
                      icon: "🔄"
                    },
                    {
                      label: "Image Size",
                      value: imageSize,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setImageSize(e.target.value as ImageSize),
                      options: [
                        { value: "fit", label: "Fit to Page" },
                        { value: "fill", label: "Fill Page" },
                        { value: "original", label: "Original Size" }
                      ],
                      icon: "📏"
                    },
                    {
                      label: "File Name",
                      value: fileName,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFileName(e.target.value),
                      type: "text",
                      placeholder: "Enter PDF file name",
                      icon: "📝"
                    },
                    {
                      label: "Margin",
                      value: margin,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setMargin(parseInt(e.target.value)),
                      type: "range",
                      min: "0",
                      max: "50",
                      icon: "↔️"
                    },
                    {
                      label: "Quality",
                      value: quality,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQuality(parseFloat(e.target.value)),
                      type: "range",
                      min: "0.1",
                      max: "1",
                      step: "0.1",
                      icon: "⭐"
                    }
                  ].map((setting, idx) => (
                    <div key={idx} className="bg-black/20 rounded-xl p-5 border border-white/5 hover:border-purple-500/30 transition-all duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-gray-300 flex items-center space-x-2">
                          <span className="text-lg">{setting.icon}</span>
                          <span>{setting.label}</span>
                        </label>
                        {setting.type === "range" && (
                          <span className="text-lg font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 rounded-full">
                            {setting.label === "Margin" ? `${setting.value}mm` : `${Math.round((setting.value as number) * 100)}%`}
                          </span>
                        )}
                      </div>
                      
                      {setting.type === "range" ? (
                        <div className="space-y-2">
                          <input
                            type="range"
                            min={setting.min}
                            max={setting.max}
                            step={setting.step}
                            value={setting.value}
                            onChange={setting.onChange}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-pink-500"
                          />
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>{setting.label === "Quality" ? "Low" : "0mm"}</span>
                            <span>{setting.label === "Quality" ? "High" : "50mm"}</span>
                          </div>
                        </div>
                      ) : setting.type === "text" ? (
                        <input
                          type="text"
                          value={setting.value as string}
                          onChange={setting.onChange as React.ChangeEventHandler<HTMLInputElement>}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                          placeholder={setting.placeholder}
                        />
                      ) : (
                        <select
                          value={setting.value as string}
                          onChange={setting.onChange as React.ChangeEventHandler<HTMLSelectElement>}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                        >
                          {setting.options?.map((option, optIdx) => (
                            <option key={optIdx} value={option.value} className="bg-gray-800">
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload Area */}
            <div 
              className={`border-3 border-dashed rounded-3xl p-12 text-center transition-all duration-500 mb-10 relative overflow-hidden
                ${isDragOver ? 'border-purple-400 bg-purple-900/20' : 'border-white/20 bg-gradient-to-br from-gray-900/30 to-gray-800/30'} 
                ${previews.length > 0 ? 'hidden' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {/* Animated Border */}
              <div className="absolute inset-0 border-2 border-transparent rounded-3xl animate-gradient-border"></div>
              
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 25px 25px, white 2%, transparent 0%), radial-gradient(circle at 75px 75px, white 2%, transparent 0%)`,
                  backgroundSize: '100px 100px'
                }}></div>
              </div>

              <div className="max-w-md mx-auto relative z-10">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10 shadow-2xl">
                  {isLoading ? (
                    <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-12 h-12 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-3">Drop your images here</h3>
                <p className="text-gray-300 mb-6">or click to browse files</p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 group">
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Select Images</span>
                  </button>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Supports JPG, PNG, WebP, GIF</span>
                  </div>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
            </div>

            {/* Preview Section */}
            {previews.length > 0 && (
              <div className="mb-10 animate-fadeIn">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Selected Images</h3>
                    <div className="flex items-center space-x-4">
                      <span className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 rounded-full border border-purple-500/30">
                        {previews.length} items
                      </span>
                      <button 
                        onClick={sortImages}
                        className="text-sm text-gray-300 hover:text-white flex items-center space-x-2 transition-colors duration-300 group"
                      >
                        <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                        </svg>
                        <span>Sort {sortOrder === "asc" ? "A→Z" : "Z→A"}</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={clear}
                      className="px-4 py-2 bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-300 rounded-xl hover:from-red-600/30 hover:to-red-700/30 transition-all duration-300 border border-red-500/30 hover:border-red-400/50 flex items-center space-x-2 group"
                    >
                      <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Clear All</span>
                    </button>
                  </div>
                </div>
                
                {/* Image Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {previews.map((p, idx) => (
                    <div 
                      key={p.id} 
                      className="group relative bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-2xl overflow-hidden border border-white/10 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
                    >
                      {/* Image Container */}
                      <div 
                        className="h-40 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center relative cursor-pointer overflow-hidden"
                        onClick={() => openPreview(idx)}
                      >
                        {/* Loading shimmer */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
                        
                        <img
                          src={p.url}
                          alt={p.name}
                          className="max-h-full max-w-full object-contain relative z-10 transition-transform duration-500 group-hover:scale-105"
                        />
                        
                        {/* Order Badge */}
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                          #{idx + 1}
                        </div>
                        
                        {/* File Size Badge */}
                        <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">
                          {formatFileSize(p.file.size)}
                        </div>
                      </div>
                      
                      {/* File Info */}
                      <div className="p-4">
                        <p className="text-sm font-medium text-white truncate mb-1" title={p.name}>
                          {p.name}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span className="flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {p.file.type.split('/')[1].toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(p.file.lastModified).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center space-x-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="p-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 transform hover:scale-110 shadow-lg"
                          title="Remove"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (idx > 0) reorderImages(idx, idx - 1);
                          }}
                          className={`p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl transition-all duration-300 transform hover:scale-110 shadow-lg ${idx === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-blue-700'}`}
                          disabled={idx === 0}
                          title="Move Left"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (idx < previews.length - 1) reorderImages(idx, idx + 1);
                          }}
                          className={`p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl transition-all duration-300 transform hover:scale-110 shadow-lg ${idx === previews.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-blue-700'}`}
                          disabled={idx === previews.length - 1}
                          title="Move Right"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {previews.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-8 animate-fadeIn">
                <button
                  onClick={generatePDF}
                  disabled={isConverting}
                  className={`px-10 py-4 rounded-2xl text-white font-bold flex items-center justify-center transition-all duration-500 transform hover:-translate-y-1 shadow-2xl
                    ${isConverting 
                      ? 'bg-gradient-to-r from-purple-400 to-pink-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-3xl'}`}
                >
                  {isConverting ? (
                    <>
                      <div className="relative">
                        <div className="w-6 h-6 border-3 border-white/30 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-6 h-6 border-3 border-t-transparent border-white rounded-full animate-spin"></div>
                      </div>
                      <span className="ml-3">Generating PDF... {progress}%</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6 mr-3 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      <span className="text-lg">Generate PDF</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-8 py-4 rounded-2xl border-2 border-white/20 text-white hover:bg-white/10 font-medium flex items-center justify-center transition-all duration-300 transform hover:-translate-y-0.5 backdrop-blur-sm group"
                >
                  <svg className="w-6 h-6 mr-3 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-lg">Add More Images</span>
                </button>
              </div>
            )}

            {/* Info Section */}
            <div className="mt-12 pt-8 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-2xl p-6 border border-blue-500/20">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-2">Privacy First</h4>
                      <p className="text-sm text-blue-200/80">
                        All processing happens locally in your browser. Your images never leave your computer.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-2xl p-6 border border-purple-500/20">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-2">High Quality</h4>
                      <p className="text-sm text-purple-200/80">
                        Preserve image quality with adjustable compression settings and multiple page formats.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-pink-900/20 to-pink-800/20 rounded-2xl p-6 border border-pink-500/20">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-pink-500/20 rounded-xl">
                      <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-2">Free & Secure</h4>
                      <p className="text-sm text-pink-200/80">
                        No registration required. Completely free to use with no hidden limitations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-gray-400 text-sm">
            Made with ❤️ • Supports up to {files.length > 0 ? 'unlimited' : 'many'} images • Client-side processing
          </p>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedPreview !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl max-w-5xl max-h-[90vh] overflow-hidden border border-white/10 shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-gray-900 to-black flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {previews[selectedPreview].name}
                </h3>
                <p className="text-sm text-gray-400">
                  Image {selectedPreview + 1} of {previews.length} • {formatFileSize(previews[selectedPreview].file.size)}
                </p>
              </div>
              <button
                onClick={closePreview}
                className="p-3 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 text-white hover:text-red-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Image */}
            <div className="p-8 flex items-center justify-center bg-gradient-to-br from-gray-950 to-black">
              <img
                src={previews[selectedPreview].url}
                alt={previews[selectedPreview].name}
                className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-2xl"
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 bg-gradient-to-r from-gray-900 to-black flex justify-between">
              <button
                onClick={() => navigatePreview("prev")}
                disabled={selectedPreview === 0}
                className={`px-6 py-3 rounded-xl flex items-center space-x-3 transition-all duration-300 ${selectedPreview === 0 ? 'opacity-30 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/40 hover:to-blue-600/40 text-white'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Previous</span>
              </button>
              
              <div className="flex items-center space-x-2">
                {previews.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPreview(idx)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === selectedPreview ? 'bg-gradient-to-r from-purple-500 to-pink-500 scale-125' : 'bg-gray-700 hover:bg-gray-600'}`}
                  />
                ))}
              </div>
              
              <button
                onClick={() => navigatePreview("next")}
                disabled={selectedPreview === previews.length - 1}
                className={`px-6 py-3 rounded-xl flex items-center space-x-3 transition-all duration-300 ${selectedPreview === previews.length - 1 ? 'opacity-30 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/40 hover:to-blue-600/40 text-white'}`}
              >
                <span>Next</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add custom animations to global CSS */}
      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes gradient-border {
          0% {
            border-image: linear-gradient(90deg, #8b5cf6, #ec4899, #3b82f6) 1;
          }
          50% {
            border-image: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899) 1;
          }
          100% {
            border-image: linear-gradient(90deg, #ec4899, #3b82f6, #8b5cf6) 1;
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        .animate-gradient-border {
          animation: gradient-border 3s infinite linear;
        }
      `}</style>
    </div>
  );
}