import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FileText } from 'lucide-react';
import { PageText } from './types';

// Настройка PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface TextExtractorProps {
  selectedFile: File;
  onTextExtracted: (text: PageText[]) => void;
  isProcessing: boolean;
  progress: number;
  onStatusChange: (status: string) => void;
}

export const TextExtractor: React.FC<TextExtractorProps> = ({
  selectedFile,
  onTextExtracted,
  isProcessing,
  progress,
  onStatusChange
}) => {
  const extractTextFromPDF = async () => {
    if (!selectedFile) return;

    try {
      onStatusChange('Загрузка PDF файла...');
      
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const totalPages = pdf.numPages;
      const extractedText: PageText[] = [];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        onStatusChange(`Извлечение текста со страницы ${pageNum} из ${totalPages}...`);
        
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (pageText) {
          extractedText.push({
            pageNumber: pageNum,
            text: pageText
          });
        }
      }

      onTextExtracted(extractedText);
      onStatusChange(`Успешно извлечен текст с ${extractedText.length} страниц`);
    } catch (error) {
      console.error('Ошибка извлечения текста:', error);
      throw new Error(`Ошибка при извлечении текста: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Извлечение текста</h2>
        <p className="text-muted-foreground">
          Извлечение текста из PDF документа
        </p>
      </div>

      {!isProcessing ? (
        <Button
          onClick={extractTextFromPDF}
          className="w-full"
          size="lg"
        >
          <FileText className="mr-2 h-4 w-4" />
          Извлечь текст из PDF
        </Button>
      ) : (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-center text-muted-foreground">
            Извлечение текста... {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  );
};