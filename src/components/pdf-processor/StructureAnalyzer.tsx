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
      
      const fullText = extractedText
        .map(page => `=== СТРАНИЦА ${page.pageNumber} ===\n${page.text}`)
        .join('\n\n');
      
      const { data, error } = await supabase.functions.invoke('ai-text-processor', {
        body: { 
          text: fullText,
          mode: 'analyze_structure'
        }
      });

      if (error) throw error;

      if (data.success) {
        const analysis = typeof data.result === 'string' 
          ? JSON.parse(data.result) 
          : data.result;
        
        // Добавляем ID и флаг selected к каждой таблице
        const enhancedAnalysis = {
          ...analysis,
          found_tables: analysis.found_tables.map((table: any, index: number) => ({
            ...table,
            id: `table-${index}`,
            selected: true // По умолчанию все выбраны
          }))
        };
        
        onAnalysisComplete(enhancedAnalysis);
        onStatusChange(`Найдено ${analysis.found_tables?.length || 0} таблиц/спецификаций`);
        
        toast({
          title: "Анализ завершен",
          description: `Найдено ${analysis.found_tables?.length || 0} структурных элементов`,
        });
      } else {
        throw new Error(data.error || 'Неизвестная ошибка анализа');
      }
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