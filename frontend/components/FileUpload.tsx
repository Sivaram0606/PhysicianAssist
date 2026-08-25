import React, { useRef, useState } from 'react';
import { UploadCloud, FileJson, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileLoaded: (data: any) => void;
  onError: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      onError('Please upload a valid JSON file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        onFileLoaded(parsedData);
      } catch (err) {
        onError('Failed to parse JSON file. Please ensure it is valid JSON.');
      }
    };
    reader.onerror = () => {
      onError('Error reading the file.');
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-12">
      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors duration-200 ease-in-out ${
          isDragging
            ? 'border-clinical-500 bg-clinical-50'
            : 'border-slate-300 hover:border-clinical-400 hover:bg-slate-50 bg-white'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".json,application/json"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={onFileInputChange}
          ref={fileInputRef}
          aria-label="Upload JSON file"
        />
        <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
          <div className="p-4 bg-clinical-100 rounded-full text-clinical-700">
            <UploadCloud size={40} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-700">
              Upload Clinical Data
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Drag and drop your JSON file here, or click to browse
            </p>
          </div>
          <div className="flex items-center text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            <FileJson size={14} className="mr-1" />
            Requires specific JSON schema
          </div>
        </div>
      </div>
    </div>
  );
};
