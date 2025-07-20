import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, FileSearch, CheckCircle } from 'lucide-react';
import { PageText, StructureAnalysis } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StructureAnalyzerProps {
  extractedText: PageText[];
  structureAnalysis: StructureAnalysis | null;
  onAnalysisComplete: (analysis: StructureAnalysis) => void;
  isProcessing: boolean;
  onStatusChange: (status: string) => void;
}

export const StructureAnalyzer: React.FC<StructureAnalyzerProps> = ({
  extractedText,
  structureAnalysis,
  onAnalysisComplete,
  isProcessing,
  onStatusChange
}) => {
  const { toast } = useToast();

  const analyzeStructure = async () => {
    if (extractedText.length === 0) {
      toast({
        title: "Нет текста для анализа",
        description: "Сначала извлеките текст из PDF",
        variant: "destructive",
      });
      return;
    }

    try {
      onStatusChange('Анализ структуры документа...');
      
      const MAX_CHUNK_SIZE = 30000; // Уменьшенный размер chunk для надежности
      const allTables: any[] = [];
      
      // Разбиваем на chunks по страницам
      const chunks = createTextChunks(extractedText, MAX_CHUNK_SIZE);
      
      onStatusChange(`Анализ структуры: обработка ${chunks.length} фрагментов...`);
      
      // Обрабатываем каждый chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        onStatusChange(`Анализ фрагмента ${i + 1}/${chunks.length}...`);
        
        try {
          // Проверяем размер текста перед отправкой
          const textSize = new Blob([chunk.text]).size;
          if (textSize > 50 * 1024) { // 50KB лимит
            console.warn(`Chunk ${i + 1} размер ${textSize} байт, пропускаем`);
            continue;
          }

          const { data, error } = await supabase.functions.invoke('structure-analyzer', {
            body: { 
              text: chunk.text,
              total_pages: extractedText.length,
              chunk_info: {
                chunk_number: i + 1,
                total_chunks: chunks.length,
                start_page: chunk.startPage,
                end_page: chunk.endPage
              }
            }
          });

          if (error) {
            console.error(`Ошибка в chunk ${i + 1}:`, error);
            continue; // Пропускаем проблемный chunk
          }

          if (data.success) {
            const analysis = typeof data.result === 'string' 
              ? JSON.parse(data.result) 
              : data.result;
            
            // Добавляем таблицы из этого chunk с коррекцией номеров страниц
            if (analysis.found_tables && analysis.found_tables.length > 0) {
              const chunkTables = analysis.found_tables.map((table: any) => ({
                ...table,
                // Корректируем номера страниц относительно всего документа
                pageNumbers: Array.isArray(table.pageNumbers) 
                  ? table.pageNumbers.map((p: number) => p + chunk.startPage - 1)
                  : [table.pageNumbers + chunk.startPage - 1],
                chunk_source: i + 1
              }));
              allTables.push(...chunkTables);
            }
          }
        } catch (chunkError) {
          console.error(`Ошибка обработки chunk ${i + 1}:`, chunkError);
          onStatusChange(`Ошибка в фрагменте ${i + 1}, продолжаем...`);
          continue; // Продолжаем обработку следующих chunks
        }
      }
      
      // Удаляем дубликаты и объединяем результаты
      const uniqueTables = removeDuplicateTables(allTables);
      
      // Создаем финальный анализ
      const finalAnalysis = {
        document_type: 'Техническая документация',
        total_pages: extractedText.length,
        found_tables: uniqueTables.map((table: any, index: number) => {
          const pageNumbers = Array.isArray(table.pageNumbers) ? table.pageNumbers : [table.pageNumbers].filter(Boolean);
          const minPage = Math.min(...pageNumbers);
          const maxPage = Math.max(...pageNumbers);
          
          const start = Math.max(1, minPage - 1);
          const end = Math.min(extractedText.length, maxPage + 2);
          
          return {
            ...table,
            id: `table-${index}`,
            selected: true,
            pageRange: { start, end },
            pageNumbers: pageNumbers
          };
        }),
        summary: `Обработано ${chunks.length} фрагментов документа. Найдено ${uniqueTables.length} уникальных таблиц/спецификаций.`,
        processing_info: {
          chunks_processed: chunks.length,
          tables_found: uniqueTables.length
        }
      };
      
      onAnalysisComplete(finalAnalysis);
      onStatusChange(`Найдено ${uniqueTables.length} таблиц/спецификаций`);
      
      toast({
        title: "Анализ завершен",
        description: `Найдено ${uniqueTables.length} структурных элементов в ${chunks.length} фрагментах`,
      });
      
    } catch (err) {
      console.error('Ошибка анализа структуры:', err);
      onStatusChange(`Ошибка анализа: ${err.message}`);
      toast({
        title: "Ошибка анализа",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Функция для создания chunks с учетом границ страниц
  const createTextChunks = (pages: PageText[], maxSize: number) => {
    const chunks: Array<{text: string, startPage: number, endPage: number}> = [];
    let currentChunk = '';
    let currentStartPage = 1;
    let currentPage = 1;
    
    for (const page of pages) {
      const pageText = `=== СТРАНИЦА ${page.pageNumber} ===\n${page.text}\n\n`;
      
      // Если добавление этой страницы превысит лимит, сохраняем текущий chunk
      if (currentChunk.length + pageText.length > maxSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          startPage: currentStartPage,
          endPage: currentPage - 1
        });
        currentChunk = pageText;
        currentStartPage = page.pageNumber;
      } else {
        currentChunk += pageText;
      }
      
      currentPage = page.pageNumber;
    }
    
    // Добавляем последний chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startPage: currentStartPage,
        endPage: currentPage
      });
    }
    
    return chunks;
  };

  // Функция для удаления дубликатов таблиц
  const removeDuplicateTables = (tables: any[]) => {
    const seen = new Set<string>();
    return tables.filter(table => {
      // Создаем уникальный ключ на основе названия и описания
      const key = `${table.title || ''}-${table.description || ''}-${table.table_type || ''}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Анализ структуры</h2>
        <p className="text-muted-foreground">
          Анализ документа для поиска таблиц и спецификаций
        </p>
      </div>

      {!structureAnalysis ? (
        <Button
          onClick={analyzeStructure}
          disabled={isProcessing || extractedText.length === 0}
          className="w-full"
          size="lg"
        >
          <Brain className="mr-2 h-4 w-4" />
          {isProcessing ? 'Анализ структуры...' : 'Анализировать структуру'}
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Анализ завершен
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {structureAnalysis.found_tables?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Найдено таблиц</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {structureAnalysis.total_pages || extractedText.length}
                </div>
                <div className="text-sm text-muted-foreground">Страниц обработано</div>
              </div>
              <div>
                <Badge variant="secondary">
                  {structureAnalysis.document_type || 'Техническая документация'}
                </Badge>
              </div>
            </div>
            
            {structureAnalysis.summary && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                {structureAnalysis.summary}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};