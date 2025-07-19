import React from 'react';
import { UploadZone } from '@/components/ui/upload-zone';
import { Button } from '@/components/ui/button';
import { FileText, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FileUploaderProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  isProcessing: boolean;
  error: string | null;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  selectedFile,
  onFileSelect,
  isProcessing,
  error
}) => {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Загрузка PDF документа</h2>
        <p className="text-muted-foreground">
          Загрузите PDF файл для анализа структуры и извлечения данных
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!selectedFile ? (
        <UploadZone
          onFileSelect={onFileSelect}
          isLoading={isProcessing}
        />
      ) : (
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!isProcessing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFileSelect(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};