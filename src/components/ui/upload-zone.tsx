import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  className?: string;
  isLoading?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileSelect,
  selectedFile,
  className,
  isLoading = false
}) => {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
    setDragActive(false);
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    disabled: isLoading
  });

  const clearFile = () => {
    onFileSelect(null as any);
  };

  if (selectedFile) {
    return (
      <div className={cn(
        "border-2 border-dashed border-border rounded-lg p-6 transition-all duration-300",
        "bg-gradient-surface shadow-card",
        className
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} МБ
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearFile}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300",
        "bg-gradient-surface shadow-card hover:shadow-elegant",
        isDragActive || dragActive 
          ? "border-primary bg-primary/5 scale-105" 
          : "border-border hover:border-primary/50",
        isLoading && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center space-y-4">
        <div className={cn(
          "p-4 rounded-full transition-colors duration-300",
          isDragActive || dragActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}>
          <Upload className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground mb-2">
            {isDragActive ? "Отпустите файл здесь" : "Загрузите PDF документ"}
          </h3>
          <p className="text-muted-foreground">
            Перетащите PDF файл сюда или <span className="text-primary font-medium">нажмите для выбора</span>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Поддерживаются только PDF файлы
          </p>
        </div>
      </div>
    </div>
  );
};