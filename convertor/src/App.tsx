import React from "react";
import ImageToPdf from "./components/ImageToPdf"; // adjust path if needed

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-sky-700 text-white py-4 shadow">
        <h1 className="text-center text-3xl font-bold">Image to PDF Converter</h1>
      </header>

      <main className="p-6">
        <ImageToPdf />
      </main>
    </div>
  );
}

export default App;
