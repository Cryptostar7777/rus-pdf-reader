import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { TableSection, ExtractionResult } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface DataExtractorProps {
  selectedSections: TableSection[];
  extractedData: ExtractionResult | null;
  onExtractionComplete: (data: ExtractionResult) => void;
  isProcessing: boolean;
  progress: number;
  onStatusChange: (status: string) => void;
}

export const DataExtractor: React.FC<DataExtractorProps> = ({
  selectedSections,
  extractedData,
  onExtractionComplete,
  isProcessing,
  progress,
  onStatusChange
}) => {
  const { toast } = useToast();

  const extractData = async () => {
    if (selectedSections.length === 0) {
      toast({
        title: "Нет выбранных секций",
        description: "Выберите секции для извлечения данных",
        variant: "destructive",
      });
      return;
    }

    try {
      onStatusChange('Извлечение структурированных данных...');
      
      // Объединяем контент выбранных секций, используя полный контент если доступен
      const combinedContent = selectedSections
        .map(section => `=== ${section.title} (${section.type}) ===\n${section.fullContent || section.content}`)
        .join('\n\n');
      
      const { data, error } = await supabase.functions.invoke('ai-text-processor', {
        body: { 
          text: combinedContent,
          mode: 'extract_structured',
          sections_info: selectedSections.map(s => ({
            title: s.title,
            type: s.type,
            pageNumbers: s.pageNumbers,
            pageRange: s.pageRange,
            hasFullContent: !!s.fullContent
          }))
        }
      });

      if (error) throw error;

      if (data.success) {
        const result = typeof data.result === 'string' 
          ? JSON.parse(data.result) 
          : data.result;
        
        onExtractionComplete(result);
        onStatusChange(`Извлечено ${result.extracted_items?.length || 0} позиций`);
        
        toast({
          title: "Извлечение завершено",
          description: `Извлечено ${result.extracted_items?.length || 0} позиций из ${selectedSections.length} секций`,
        });
      } else {
        throw new Error(data.error || 'Неизвестная ошибка извлечения');
      }
    } catch (err) {
      console.error('Ошибка извлечения данных:', err);
      onStatusChange(`Ошибка извлечения: ${err.message}`);
      toast({
        title: "Ошибка извлечения",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const exportToExcel = () => {
    if (!extractedData?.extracted_items) return;

    const worksheet = XLSX.utils.json_to_sheet(extractedData.extracted_items);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Извлеченные данные');
    
    const fileName = `extracted_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Экспорт завершен",
      description: `Данные экспортированы в файл ${fileName}`,
    });
  };

  const downloadJSON = () => {
    if (!extractedData) return;

    const dataStr = JSON.stringify(extractedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `extracted_data_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast({
      title: "JSON экспортирован",
      description: `Данные сохранены в файл ${exportFileDefaultName}`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Извлечение данных</h2>
        <p className="text-muted-foreground">
          Извлечение структурированных данных из выбранных секций
        </p>
      </div>

      {!extractedData ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            Будет обработано секций: {selectedSections.length}
          </div>
          
          {!isProcessing ? (
            <Button
              onClick={extractData}
              disabled={selectedSections.length === 0}
              className="w-full"
              size="lg"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Извлечь структурированные данные
            </Button>
          ) : (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                Извлечение данных... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Извлечение завершено
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {extractedData.extracted_items?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Позиций извлечено</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {extractedData.summary?.systems_found?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Систем найдено</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {extractedData.summary?.sections_processed?.length || selectedSections.length}
                </div>
                <div className="text-sm text-muted-foreground">Секций обработано</div>
              </div>
            </div>

            {extractedData.summary?.systems_found && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Найденные системы:</div>
                <div className="flex flex-wrap gap-1">
                  {extractedData.summary.systems_found.map((system, index) => (
                    <Badge key={index} variant="secondary">
                      {system}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={exportToExcel}
                variant="outline"
                className="flex-1"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Экспорт в Excel
              </Button>
              <Button
                onClick={downloadJSON}
                variant="outline"
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Скачать JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};