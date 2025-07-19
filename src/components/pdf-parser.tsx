import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { UploadZone } from './ui/upload-zone';
import { TextDisplay } from './ui/text-display';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { AlertCircle, Download, FileText, Brain, FileSpreadsheet } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

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
  const [structureAnalysis, setStructureAnalysis] = useState<any>(null);
  const [structuredData, setStructuredData] = useState<any>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setExtractedText([]);
    setError(null);
    setProgress(0);
    setAiResult(null);
    setStructureAnalysis(null);
    setStructuredData(null);
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

  const analyzeDocumentStructure = async () => {
    if (extractedText.length === 0) {
      toast({
        title: "Нет текста для анализа",
        description: "Сначала извлеките текст из PDF",
        variant: "destructive",
      });
      return;
    }

    setIsAiProcessing(true);
    setError(null);
    
    try {
      // Объединяем весь текст из всех страниц
      const fullText = extractedText
        .map(page => `=== СТРАНИЦА ${page.pageNumber} ===\n${page.text}`)
        .join('\n\n');
      
      console.log('Отправляем текст на анализ структуры, символов:', fullText.length);
      
      const { data, error } = await supabase.functions.invoke('ai-text-processor', {
        body: { 
          text: fullText,
          mode: 'extract'
        }
      });

      if (error) throw error;

      if (data.success) {
        console.log('Получен результат анализа:', data.result);
        
        // Пытаемся распарсить JSON ответ
        try {
          const parsedResult = JSON.parse(data.result);
          setStructureAnalysis(parsedResult);
          
          toast({
            title: "Анализ завершен",
            description: `Найдено ${parsedResult.found_tables?.length || 0} таблиц/спецификаций`,
          });
        } catch (parseError) {
          // Если не JSON, сохраняем как есть
          setStructureAnalysis({ raw_response: data.result });
          
          toast({
            title: "Анализ завершен",
            description: "Результат получен (текстовый формат)",
          });
        }

      } else {
        throw new Error(data.error || 'Неизвестная ошибка анализа');
      }

    } catch (err) {
      console.error('Ошибка анализа структуры:', err);
      setError(`Ошибка анализа: ${err.message}`);
      toast({
        title: "Ошибка анализа",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const extractStructuredData = async () => {
    if (extractedText.length === 0) {
      toast({
        title: "Нет текста для анализа",
        description: "Сначала извлеките текст из PDF",
        variant: "destructive",
      });
      return;
    }

    setIsAiProcessing(true);
    setError(null);
    
    try {
      // Объединяем весь текст из всех страниц
      const fullText = extractedText
        .map(page => `=== СТРАНИЦА ${page.pageNumber} ===\n${page.text}`)
        .join('\n\n');
      
      console.log('Извлекаем структурированные данные, символов:', fullText.length);
      
      const { data, error } = await supabase.functions.invoke('ai-text-processor', {
        body: { 
          text: fullText,
          mode: 'structured'
        }
      });

      if (error) throw error;

      if (data.success) {
        console.log('Получены структурированные данные:', data.result);
        
        // Пытаемся распарсить JSON ответ
        try {
          const parsedResult = JSON.parse(data.result);
          setStructuredData(parsedResult);
          
          toast({
            title: "Извлечение завершено",
            description: `Извлечено ${parsedResult.extracted_items?.length || 0} позиций`,
          });
        } catch (parseError) {
          // Если не JSON, сохраняем как есть
          setStructuredData({ raw_response: data.result });
          
          toast({
            title: "Извлечение завершено",
            description: "Данные получены (требуется проверка формата)",
          });
        }

      } else {
        throw new Error(data.error || 'Неизвестная ошибка извлечения');
      }

    } catch (err) {
      console.error('Ошибка извлечения структурированных данных:', err);
      setError(`Ошибка извлечения: ${err.message}`);
      toast({
        title: "Ошибка извлечения",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const exportToExcel = () => {
    if (!structuredData?.extracted_items || structuredData.extracted_items.length === 0) {
      toast({
        title: "Нет данных для экспорта",
        description: "Сначала извлеките структурированные данные",
        variant: "destructive",
      });
      return;
    }

    try {
      // Создаем рабочую книгу
      const wb = XLSX.utils.book_new();
      
      // Создаем лист с данными
      const ws = XLSX.utils.json_to_sheet(structuredData.extracted_items);
      
      // Устанавливаем ширину колонок
      const colWidths = [
        { wch: 15 }, // Наименование системы
        { wch: 20 }, // Наименование раздела  
        { wch: 40 }, // Наименование
        { wch: 50 }, // Технические характеристики
        { wch: 20 }, // Тип, марка
        { wch: 10 }, // Код изделия
        { wch: 20 }, // Завод изготовитель
        { wch: 10 }, // Ед измерения
        { wch: 10 }, // Количество
        { wch: 15 }, // Категория
        { wch: 25 }  // Примечание
      ];
      ws['!cols'] = colWidths;
      
      // Добавляем лист в книгу
      XLSX.utils.book_append_sheet(wb, ws, "Спецификация");
      
      // Создаем имя файла
      const fileName = `${selectedFile?.name.replace('.pdf', '') || 'specification'}_structured_data.xlsx`;
      
      // Сохраняем файл
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Excel файл сохранен",
        description: `Сохранено ${structuredData.extracted_items.length} позиций в ${fileName}`,
      });
      
    } catch (error) {
      console.error('Ошибка экспорта в Excel:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать Excel файл",
        variant: "destructive",
      });
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
          <div className="flex justify-between items-center flex-wrap gap-2">
            <Button
              onClick={downloadText}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Скачать текст</span>
            </Button>
            
            <div className="flex gap-2">
              <Button
                onClick={analyzeDocumentStructure}
                disabled={isAiProcessing}
                variant="secondary"
                className="bg-primary/10 hover:bg-primary/20"
              >
                <Brain className="h-5 w-5 mr-2" />
                {isAiProcessing ? 'Анализируем...' : 'Анализ структуры'}
              </Button>
              
              <Button
                onClick={extractStructuredData}
                disabled={isAiProcessing}
                className="bg-gradient-primary hover:opacity-90"
              >
                <FileText className="h-5 w-5 mr-2" />
                {isAiProcessing ? 'Извлекаем...' : 'Извлечь данные'}
              </Button>
              
              {structuredData?.extracted_items && (
                <Button
                  onClick={exportToExcel}
                  variant="outline"
                  className="bg-success/10 hover:bg-success/20 border-success/50"
                >
                  <FileSpreadsheet className="h-5 w-5 mr-2" />
                  Экспорт в Excel
                </Button>
              )}
            </div>
          </div>
          
          {/* Результат анализа структуры */}
          {structureAnalysis && (
            <div className="space-y-4">
              <Alert>
                <Brain className="h-4 w-4" />
                <AlertDescription>
                  <strong>Результат анализа структуры документа:</strong>
                  <div className="mt-3">
                    {structureAnalysis.found_tables ? (
                      <div className="space-y-3">
                        {structureAnalysis.found_tables.map((table: any, index: number) => (
                          <div key={index} className="border border-border rounded-lg p-4 bg-card">
                            <h4 className="font-semibold text-card-foreground mb-2">
                              {table.title || `Таблица ${index + 1}`}
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              Тип: <span className="font-medium">{table.type || 'неизвестно'}</span>
                            </p>
                            <div className="text-sm text-card-foreground bg-muted p-3 rounded max-h-32 overflow-y-auto">
                              {table.content || 'Содержимое не извлечено'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-muted rounded text-sm">
                        {structureAnalysis.raw_response || JSON.stringify(structureAnalysis, null, 2)}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {/* Результат извлечения структурированных данных */}
          {structuredData && (
            <div className="space-y-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  <strong>Извлеченные структурированные данные:</strong>
                  {structuredData.summary && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                      <strong>Сводка:</strong> {structuredData.summary.total_items} позиций, 
                      системы: {structuredData.summary.systems_found?.join(', ')}
                    </div>
                  )}
                  <div className="mt-3">
                    {structuredData.extracted_items ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-border rounded-lg">
                          <thead className="bg-muted">
                            <tr>
                              <th className="border border-border px-2 py-1 text-xs">Наим. системы</th>
                              <th className="border border-border px-2 py-1 text-xs">Раздел</th>
                              <th className="border border-border px-2 py-1 text-xs">Наименование</th>
                              <th className="border border-border px-2 py-1 text-xs">Характеристики</th>
                              <th className="border border-border px-2 py-1 text-xs">Марка</th>
                              <th className="border border-border px-2 py-1 text-xs">Код</th>
                              <th className="border border-border px-2 py-1 text-xs">Завод</th>
                              <th className="border border-border px-2 py-1 text-xs">Ед.изм</th>
                              <th className="border border-border px-2 py-1 text-xs">Кол-во</th>
                              <th className="border border-border px-2 py-1 text-xs">Категория</th>
                            </tr>
                          </thead>
                          <tbody>
                            {structuredData.extracted_items.slice(0, 20).map((item: any, index: number) => (
                              <tr key={index} className="hover:bg-muted/50">
                                <td className="border border-border px-2 py-1 text-xs">{item["Наименование системы"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs">{item["Наименование раздела"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs">{item["Наименование"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs max-w-xs truncate" title={item["Технические характеристики"]}>{item["Технические характеристики"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs">{item["Тип, марка, обозначение"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs">{item["Код изделия"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs">{item["Завод изготовитель"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs">{item["Ед измерения"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs">{item["Количество"] || ''}</td>
                                <td className="border border-border px-2 py-1 text-xs">{item["Категория"] || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {structuredData.extracted_items.length > 20 && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Показано первых 20 из {structuredData.extracted_items.length} позиций
                            {structuredData.summary?.total_items && 
                              ` (ожидалось: ${structuredData.summary.total_items})`
                            }
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-muted rounded text-sm">
                        {structuredData.raw_response || JSON.stringify(structuredData, null, 2)}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <TextDisplay
            pages={extractedText}
            fileName={selectedFile?.name}
          />
        </div>
      )}
    </div>
  );
};