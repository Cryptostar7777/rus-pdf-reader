import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { UploadZone } from './ui/upload-zone';
import { TextDisplay } from './ui/text-display';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { AlertCircle, Download, FileText, Brain } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Настройка PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PageText {
  pageNumber: number;
  text: string;
}

export const PDFParser: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState<PageText[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setExtractedText([]);
    setError(null);
    setProgress(0);
  };

  const extractTextFromPDF = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setExtractedText([]);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const pages: PageText[] = [];

      toast({
        title: "Начинаем обработку",
        description: `Найдено ${numPages} страниц для обработки`,
      });

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Извлекаем текст со страницы
          const pageText = textContent.items
            .map((item: any) => {
              if ('str' in item) {
                return item.str;
              }
              return '';
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          pages.push({
            pageNumber: pageNum,
            text: pageText
          });

          // Обновляем прогресс
          const progressValue = (pageNum / numPages) * 100;
          setProgress(progressValue);
          setExtractedText([...pages]);

        } catch (pageError) {
          console.error(`Ошибка при обработке страницы ${pageNum}:`, pageError);
          pages.push({
            pageNumber: pageNum,
            text: `Ошибка при извлечении текста со страницы ${pageNum}`
          });
        }
      }

      setExtractedText(pages);
      toast({
        title: "Обработка завершена",
        description: `Текст успешно извлечен из ${pages.length} страниц`,
      });

    } catch (err) {
      console.error('Ошибка при обработке PDF:', err);
      setError('Ошибка при обработке PDF файла. Убедитесь, что файл не поврежден.');
      toast({
        title: "Ошибка обработки",
        description: "Не удалось обработать PDF файл",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const downloadText = () => {
    if (extractedText.length === 0) return;

    const content = extractedText
      .map(page => `=== СТРАНИЦА ${page.pageNumber} ===\n${page.text}`)
      .join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFile?.name.replace('.pdf', '')}_extracted_text.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Файл сохранен",
      description: "Извлеченный текст сохранен в файл",
    });
  };

  const testAiIntegration = async () => {
    setIsAiProcessing(true);
    setError(null);
    
    try {
      const testText = "Привет! Тестируем интеграцию с OpenAI API.";
      
      console.log('Отправляем тестовый запрос к AI...');
      const { data, error } = await supabase.functions.invoke('ai-text-processor', {
        body: { 
          text: testText,
          mode: 'test'
        }
      });

      if (error) throw error;

      if (data.success) {
        setAiResult(data.result);
        toast({
          title: "AI интеграция работает!",
          description: `Токенов использовано: ${data.tokens_used?.total_tokens || 'неизвестно'}`,
        });
      } else {
        throw new Error(data.error || 'Неизвестная ошибка AI');
      }

    } catch (err) {
      console.error('Ошибка AI тестирования:', err);
      setError(`Ошибка AI: ${err.message}`);
      toast({
        title: "Ошибка AI интеграции",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <UploadZone
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        isLoading={isProcessing}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {selectedFile && !isProcessing && extractedText.length === 0 && (
        <div className="text-center space-y-4">
          <Button
            onClick={extractTextFromPDF}
            size="lg"
            className="bg-gradient-primary hover:opacity-90 shadow-elegant mr-4"
          >
            <FileText className="h-5 w-5 mr-2" />
            Извлечь текст из PDF
          </Button>
          
          <Button
            onClick={testAiIntegration}
            size="lg"
            variant="secondary"
            disabled={isAiProcessing}
            className="bg-primary/10 hover:bg-primary/20"
          >
            <Brain className="h-5 w-5 mr-2" />
            {isAiProcessing ? 'Тестируем AI...' : 'Тест AI интеграции'}
          </Button>
        </div>
      )}

      {/* AI результат */}
      {aiResult && (
        <div className="space-y-4">
          <Alert>
            <Brain className="h-4 w-4" />
            <AlertDescription>
              <strong>Результат AI тестирования:</strong>
              <div className="mt-2 p-3 bg-muted rounded text-sm">
                {aiResult}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {isProcessing && (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Обрабатываем PDF документ...
            </p>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {extractedText.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={downloadText}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Скачать текст</span>
            </Button>
          </div>
          
          <TextDisplay
            pages={extractedText}
            fileName={selectedFile?.name}
          />
        </div>
      )}
    </div>
  );
};