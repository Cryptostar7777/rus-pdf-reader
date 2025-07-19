import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react';
import { ExtractionResult } from './types';
import * as XLSX from 'xlsx';

interface ExtractionResultsProps {
  extractionResult: ExtractionResult;
  onExportExcel?: () => void;
  onExportJson?: () => void;
}

export const ExtractionResults: React.FC<ExtractionResultsProps> = ({
  extractionResult,
  onExportExcel,
  onExportJson
}) => {
  const exportToExcel = () => {
    if (!extractionResult?.extracted_items?.length) return;

    const worksheet = XLSX.utils.json_to_sheet(extractionResult.extracted_items);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Извлеченные данные');
    
    XLSX.writeFile(workbook, `extracted_data_${new Date().getTime()}.xlsx`);
  };

  const downloadJSON = () => {
    if (!extractionResult) return;

    const jsonData = JSON.stringify(extractionResult, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `extracted_data_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const { summary, processing_info } = extractionResult;

  return (
    <div className="space-y-6">
      {/* Основная статистика */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Результаты извлечения
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {summary.total_items}
              </div>
              <div className="text-sm text-muted-foreground">Всего позиций</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">
                {summary.systems_found.length}
              </div>
              <div className="text-sm text-muted-foreground">Систем</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {summary.sections_processed.length}
              </div>
              <div className="text-sm text-muted-foreground">Разделов</div>
            </div>
            {summary.duplicates_removed && (
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">
                  {summary.duplicates_removed}
                </div>
                <div className="text-sm text-muted-foreground">Дубликатов удалено</div>
              </div>
            )}
          </div>

          {/* Кнопки экспорта */}
          <div className="flex gap-3 pt-4">
            <Button onClick={onExportExcel || exportToExcel} className="flex-1">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Экспорт в Excel
            </Button>
            <Button variant="outline" onClick={onExportJson || downloadJSON} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Скачать JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Предупреждения валидации */}
      {summary.validation?.warnings && summary.validation.warnings.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Предупреждения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {summary.validation.warnings.map((warning, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-warning mt-1">•</span>
                  {warning}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Найденные системы */}
      {summary.systems_found.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Найденные системы</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.systems_found.map((system, index) => (
                <Badge key={index} variant="secondary">
                  {system}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Статистика качества */}
      {summary.validation?.stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Качество данных</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold">
                  {summary.total_items - summary.validation.stats.items_with_missing_fields}
                </div>
                <div className="text-xs text-muted-foreground">Полных позиций</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {summary.total_items - summary.validation.stats.items_without_quantity}
                </div>
                <div className="text-xs text-muted-foreground">С количеством</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {summary.total_items - summary.validation.stats.items_without_manufacturer}
                </div>
                <div className="text-xs text-muted-foreground">С производителем</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {summary.validation.stats.systems_coverage}
                </div>
                <div className="text-xs text-muted-foreground">Систем покрыто</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Информация о процессе */}
      {processing_info && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Информация о процессе</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-green-600">
                  {processing_info.successful_chunks}
                </div>
                <div className="text-xs text-muted-foreground">Успешно</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">
                  {processing_info.failed_chunks}
                </div>
                <div className="text-xs text-muted-foreground">Ошибок</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {processing_info.chunks_processed}
                </div>
                <div className="text-xs text-muted-foreground">Всего частей</div>
              </div>
            </div>

            {processing_info.processing_notes && processing_info.processing_notes.length > 0 && (
              <div className="text-sm text-muted-foreground space-y-1">
                <strong>Заметки:</strong>
                <ul className="ml-4">
                  {processing_info.processing_notes.map((note, index) => (
                    <li key={index} className="list-disc">{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Предварительный просмотр данных */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Предварительный просмотр (первые 5 позиций)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {extractionResult.extracted_items.slice(0, 5).map((item, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="font-medium text-sm mb-1">
                  {item["Наименование"]}
                </div>
                <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                  <span><strong>Тип:</strong> {item["Тип, марка, обозначение"]}</span>
                  <span><strong>Количество:</strong> {item["Количество"]} {item["Ед измерения"]}</span>
                  <span><strong>Система:</strong> {item["Наименование системы"]}</span>
                  <span><strong>Производитель:</strong> {item["Завод изготовитель"]}</span>
                </div>
              </div>
            ))}
            {extractionResult.extracted_items.length > 5 && (
              <div className="text-center text-muted-foreground text-sm py-2">
                ... и еще {extractionResult.extracted_items.length - 5} позиций
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};