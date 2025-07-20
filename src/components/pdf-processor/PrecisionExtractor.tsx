import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TableSection, ExtractionResult, PageText } from './types';
import { CheckCircle, AlertTriangle, Clock, FileText } from 'lucide-react';
import { ExtractionResults } from './ExtractionResults';

interface PrecisionExtractorProps {
  selectedSections: TableSection[];
  pdfPages: PageText[];
  onExtractionComplete: (data: ExtractionResult) => void;
  onStatusChange: (status: string) => void;
}

interface ProcessingStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
}

export const PrecisionExtractor: React.FC<PrecisionExtractorProps> = ({
  selectedSections,
  pdfPages,
  onExtractionComplete,
  onStatusChange
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [stages, setStages] = useState<ProcessingStage[]>([
    { id: 'structure', name: 'Повторный анализ структуры', status: 'pending', progress: 0 },
    { id: 'chunking', name: 'Умное разбиение на части', status: 'pending', progress: 0 },
    { id: 'extraction', name: 'Параллельное извлечение данных', status: 'pending', progress: 0 },
    { id: 'processing', name: 'Объединение и валидация', status: 'pending', progress: 0 }
  ]);

  const updateStage = (stageId: string, updates: Partial<ProcessingStage>) => {
    setStages(prev => prev.map(stage => 
      stage.id === stageId ? { ...stage, ...updates } : stage
    ));
  };

  const getFullSectionContent = (section: TableSection): string => {
    const startPage = Math.max(1, section.pageRange.start - 1);
    const endPage = Math.min(pdfPages.length, section.pageRange.end + 1);
    
    return pdfPages
      .filter(page => page.pageNumber >= startPage && page.pageNumber <= endPage)
      .map(page => page.text)
      .join('\n\n');
  };

  const intelligentChunkSection = (section: TableSection) => {
    const fullContent = getFullSectionContent(section);
    const maxChunkSize = 45000; // Увеличенный лимит для полных таблиц
    
    // Если секция помещается целиком - не делим
    if (fullContent.length <= maxChunkSize) {
      return [{
        ...section,
        fullContent,
        chunkIndex: 0,
        totalChunks: 1,
        strategy: 'full_section'
      }];
    }

    // УМНОЕ РАЗДЕЛЕНИЕ ПО ТАБЛИЦАМ
    const chunks = [];
    const tablePatterns = [
      /^(\d+\.?\d*\s+.{10,})/gm,  // Строки с номерами позиций
      /^(П\d+|В\d+|ОВ\d+|Т\d+)\s+/gm,  // Строки систем
      /^\s*\d+\s+[А-Я].{20,}/gm,  // Строки оборудования
    ];
    
    // Находим все границы таблиц
    let tableStarts = [];
    for (const pattern of tablePatterns) {
      let match;
      while ((match = pattern.exec(fullContent)) !== null) {
        tableStarts.push(match.index);
      }
    }
    
    tableStarts = [...new Set(tableStarts)].sort((a, b) => a - b);
    
    if (tableStarts.length === 0) {
      // Если таблицы не найдены - простое деление
      return createSimpleChunks(section, fullContent, maxChunkSize);
    }
    
    // Группируем по таблицам с учетом размера
    let currentChunk = '';
    let currentStart = 0;
    let chunkCount = 0;
    
    for (let i = 0; i < tableStarts.length; i++) {
      const nextTableStart = tableStarts[i];
      const nextTableEnd = i < tableStarts.length - 1 ? tableStarts[i + 1] : fullContent.length;
      const tableContent = fullContent.slice(nextTableStart, nextTableEnd);
      
      // Если добавление таблицы превысит лимит - сохраняем текущий кусок
      if (currentChunk.length + tableContent.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(createChunk(section, currentChunk, chunkCount++, currentStart));
        currentChunk = tableContent;
        currentStart = nextTableStart;
      } else {
        currentChunk += tableContent;
        if (currentStart === 0) currentStart = nextTableStart;
      }
    }
    
    // Добавляем последний кусок
    if (currentChunk.length > 0) {
      chunks.push(createChunk(section, currentChunk, chunkCount++, currentStart));
    }
    
    // Устанавливаем общее количество кусков
    chunks.forEach(chunk => chunk.totalChunks = chunks.length);
    
    console.log(`🧩 Секция "${section.title}" разделена на ${chunks.length} умных кусков`);
    return chunks;
  };

  const createSimpleChunks = (section: TableSection, fullContent: string, maxChunkSize: number) => {
    const chunks = [];
    const totalChunks = Math.ceil(fullContent.length / maxChunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * maxChunkSize;
      const end = Math.min(start + maxChunkSize, fullContent.length);
      const chunkContent = fullContent.slice(start, end);
      
      chunks.push(createChunk(section, chunkContent, i, start, totalChunks));
    }
    
    return chunks;
  };

  const createChunk = (section: TableSection, content: string, index: number, startPos: number, totalChunks?: number) => {
    return {
      ...section,
      id: `${section.id}_chunk_${index}`,
      title: `${section.title} (кусок ${index + 1}${totalChunks ? `/${totalChunks}` : ''})`,
      fullContent: content,
      chunkIndex: index,
      totalChunks: totalChunks || 0,
      contentStart: startPos,
      strategy: 'intelligent_split'
    };
  };

  const startPrecisionExtraction = async () => {
    setIsProcessing(true);
    onStatusChange('Запуск precision-first извлечения...');

    try {
      // Этап 1: Повторный анализ структуры
      updateStage('structure', { status: 'running', progress: 20 });
      onStatusChange('Повторный анализ структуры для оптимизации...');

      const allText = pdfPages.map(page => page.text).join('\n\n');
      
      const structureResponse = await supabase.functions.invoke('structure-analyzer', {
        body: { 
          text: allText,
          total_pages: pdfPages.length
        }
      });

      if (structureResponse.error) {
        throw new Error(structureResponse.error.message);
      }

      const structureResult = JSON.parse(structureResponse.data.result);
      updateStage('structure', { status: 'completed', progress: 100, result: structureResult });

      // Этап 2: Умное разбиение
      updateStage('chunking', { status: 'running', progress: 30 });
      onStatusChange('Разбиение больших секций на оптимальные части...');

      const allChunks = [];
      for (const section of selectedSections) {
        const chunks = intelligentChunkSection(section);
        allChunks.push(...chunks);
        console.log(`📋 Секция "${section.title}": ${chunks.length} кусков, стратегия: ${chunks[0].strategy}`);
      }

      console.log(`📊 Создано частей для обработки: ${allChunks.length}`);
      updateStage('chunking', { 
        status: 'completed', 
        progress: 100, 
        result: { total_chunks: allChunks.length, sections_split: selectedSections.length }
      });

      // Этап 3: Параллельное извлечение
      updateStage('extraction', { status: 'running', progress: 40 });
      onStatusChange(`Параллельное извлечение данных из ${allChunks.length} частей...`);

      const extractionPromises = allChunks.map(async (chunk, index) => {
        try {
          onStatusChange(`Обработка части ${index + 1}/${allChunks.length}: ${chunk.title}`);
          
          const response = await supabase.functions.invoke('data-extractor', {
            body: {
              text: chunk.fullContent,
              section_info: {
                title: chunk.title,
                type: chunk.type,
                pageNumbers: chunk.pageNumbers
              },
              chunk_index: chunk.chunkIndex || 0,
              total_chunks: chunk.totalChunks || 1
            }
          });

          if (response.error) {
            console.error(`Ошибка обработки части ${index + 1}:`, response.error);
            return { success: false, error: response.error.message, chunk_index: index };
          }

          return { success: true, result: response.data.result, chunk_index: index };
        } catch (error) {
          console.error(`Ошибка обработки части ${index + 1}:`, error);
          return { success: false, error: error.message, chunk_index: index };
        }
      });

      // Обработка по батчам для контроля нагрузки
      const batchSize = 3;
      const extractionResults = [];
      
      for (let i = 0; i < extractionPromises.length; i += batchSize) {
        const batch = extractionPromises.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        extractionResults.push(...batchResults);
        
        const progressPercent = Math.min(95, 40 + (i + batchSize) / extractionPromises.length * 50);
        updateStage('extraction', { progress: progressPercent });
      }

      updateStage('extraction', { 
        status: 'completed', 
        progress: 100, 
        result: { 
          total_processed: extractionResults.length,
          successful: extractionResults.filter(r => r.success).length,
          failed: extractionResults.filter(r => !r.success).length
        }
      });

      // Этап 4: Объединение и валидация
      updateStage('processing', { status: 'running', progress: 96 });
      onStatusChange('Объединение результатов и валидация полноты...');

      const processingResponse = await supabase.functions.invoke('result-processor', {
        body: {
          chunks_results: extractionResults,
          validation_info: {
            expected_minimum_items: Math.floor(allChunks.length * 10), // Примерная оценка
            selected_sections_count: selectedSections.length,
            total_pages_processed: allChunks.reduce((sum, chunk) => 
              sum + (chunk.pageRange.end - chunk.pageRange.start + 1), 0
            )
          }
        }
      });

      if (processingResponse.error) {
        throw new Error(processingResponse.error.message);
      }

      const finalResult = processingResponse.data.result;
      updateStage('processing', { status: 'completed', progress: 100, result: finalResult });

      // Уведомления о результате
      const { summary } = finalResult;
      
      if (summary.validation.warnings.length > 0) {
        toast.warning(`Извлечено ${summary.total_items} позиций с предупреждениями`, {
          description: summary.validation.warnings.join('; ')
        });
      } else {
        toast.success(`Успешно извлечено ${summary.total_items} позиций`, {
          description: `Системы: ${summary.systems_found.length}, дубликатов удалено: ${summary.duplicates_removed}`
        });
      }

      onExtractionComplete(finalResult);
      onStatusChange(`Завершено! Извлечено ${summary.total_items} позиций из ${summary.sections_processed.length} секций`);

    } catch (error) {
      console.error('Ошибка precision extraction:', error);
      
      // Обновляем текущий этап как ошибочный
      const runningStage = stages.find(s => s.status === 'running');
      if (runningStage) {
        updateStage(runningStage.id, { status: 'error', error: error.message });
      }
      
      toast.error('Ошибка при извлечении данных', {
        description: error.message
      });
      onStatusChange(`Ошибка: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStageIcon = (status: ProcessingStage['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Precision-First Извлечение
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Гарантированное извлечение всех позиций с помощью специализированных агентов
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              Секций выбрано: {selectedSections.length}
            </Badge>
            <Badge variant="outline">
              Страниц для обработки: {selectedSections.reduce((sum, section) => 
                sum + (section.pageRange.end - section.pageRange.start + 1), 0
              )}
            </Badge>
          </div>

          <Button 
            onClick={startPrecisionExtraction}
            disabled={isProcessing || selectedSections.length === 0}
            className="w-full"
          >
            {isProcessing ? 'Обработка...' : 'Запустить Precision Extraction'}
          </Button>
        </CardContent>
      </Card>

      {/* Этапы обработки */}
      <div className="space-y-3">
        {stages.map((stage) => (
          <Card key={stage.id} className="p-4">
            <div className="flex items-center gap-3">
              {getStageIcon(stage.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {stage.progress}%
                  </span>
                </div>
                <Progress value={stage.progress} className="mt-2" />
                
                {stage.result && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {stage.id === 'structure' && (
                      <>Найдено секций: {stage.result.found_tables?.length}</>
                    )}
                    {stage.id === 'chunking' && (
                      <>Создано частей: {stage.result.total_chunks}</>
                    )}
                    {stage.id === 'extraction' && (
                      <>Обработано: {stage.result.successful}/{stage.result.total_processed}</>
                    )}
                    {stage.id === 'processing' && (
                      <>Извлечено: {stage.result.summary?.total_items} позиций</>
                    )}
                  </div>
                )}
                
                {stage.error && (
                  <div className="mt-2 text-xs text-red-500">
                    Ошибка: {stage.error}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Результаты извлечения */}
      {stages.find(s => s.id === 'processing')?.status === 'completed' && 
       stages.find(s => s.id === 'processing')?.result && (
        <ExtractionResults 
          extractionResult={stages.find(s => s.id === 'processing')?.result}
        />
      )}
    </div>
  );
};