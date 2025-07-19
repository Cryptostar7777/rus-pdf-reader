import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageText, StructureAnalysis, ExtractionResult } from './types';

interface ResultsDisplayProps {
  extractedText?: PageText[];
  structureAnalysis?: StructureAnalysis;
  extractionResult?: ExtractionResult;
  currentStage: string;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  extractedText,
  structureAnalysis,
  extractionResult,
  currentStage
}) => {
  if (currentStage === 'upload' || currentStage === 'extract') {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Результат извлечения текста */}
      {extractedText && currentStage !== 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📄 Извлечение текста</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                Страниц: {extractedText.length}
              </Badge>
              <Badge variant="secondary">
                Символов: {extractedText.reduce((sum, page) => sum + page.text.length, 0).toLocaleString()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Результат анализа структуры */}
      {structureAnalysis && (currentStage === 'analyze' || currentStage === 'select' || currentStage === 'extract_data' || currentStage === 'complete') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🔍 Анализ структуры</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  Найдено разделов: {structureAnalysis.found_tables.length}
                </Badge>
                <Badge variant="secondary">
                  Тип документа: {structureAnalysis.document_type}
                </Badge>
              </div>
              
              {structureAnalysis.summary && (
                <div className="text-sm text-muted-foreground">
                  <strong>Краткое описание:</strong> {structureAnalysis.summary}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {structureAnalysis.found_tables.map((table) => (
                  <div key={table.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{table.title}</h4>
                      <Badge variant="outline">{table.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Стр. {table.pageNumbers.join(', ')}</span>
                      {table.pageRange && (
                        <span>• Диапазон: {table.pageRange.start}-{table.pageRange.end}</span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground max-h-12 overflow-hidden">
                      {table.content.substring(0, 100)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Результат извлечения данных */}
      {extractionResult && currentStage === 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">✅ Результат извлечения</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="default">
                  Извлечено позиций: {extractionResult.summary.total_items}
                </Badge>
                <Badge variant="secondary">
                  Систем: {extractionResult.summary.systems_found.length}
                </Badge>
                <Badge variant="secondary">
                  Разделов: {extractionResult.summary.sections_processed.length}
                </Badge>
              </div>

              {extractionResult.summary.systems_found.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Найденные системы:</h4>
                  <div className="flex flex-wrap gap-1">
                    {extractionResult.summary.systems_found.map((system, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {system}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {extractionResult.summary.sections_processed.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Обработанные разделы:</h4>
                  <div className="flex flex-wrap gap-1">
                    {extractionResult.summary.sections_processed.map((section, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {section}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto">
                <h4 className="font-medium mb-2">Первые 5 позиций:</h4>
                <div className="space-y-2">
                  {extractionResult.extracted_items.slice(0, 5).map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg text-sm">
                      <div className="font-medium">{item["Наименование"]}</div>
                      <div className="text-muted-foreground">
                        {item["Тип, марка, обозначение"]} • {item["Количество"]} {item["Ед измерения"]}
                      </div>
                      {item["Наименование системы"] && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Система: {item["Наименование системы"]}
                        </div>
                      )}
                    </div>
                  ))}
                  {extractionResult.extracted_items.length > 5 && (
                    <div className="text-center text-muted-foreground text-sm">
                      ... и еще {extractionResult.extracted_items.length - 5} позиций
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};