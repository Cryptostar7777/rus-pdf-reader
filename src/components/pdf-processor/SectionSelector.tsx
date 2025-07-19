import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSection } from './types';
import { FileText, Play } from 'lucide-react';

interface SectionSelectorProps {
  sections: TableSection[];
  onSectionToggle: (sectionId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onProceedToExtraction: () => void;
  isProcessing: boolean;
}

export const SectionSelector: React.FC<SectionSelectorProps> = ({
  sections,
  onSectionToggle,
  onSelectAll,
  onSelectNone,
  onProceedToExtraction,
  isProcessing
}) => {
  const selectedCount = sections.filter(section => section.selected).length;
  const totalCount = sections.length;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'спецификация': return 'bg-blue-100 text-blue-800';
      case 'ведомость': return 'bg-green-100 text-green-800';
      case 'характеристики': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Выбор секций для извлечения</h2>
        <p className="text-muted-foreground">
          Выберите таблицы и спецификации для извлечения данных
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Выбрано: {selectedCount} из {totalCount}
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Выбрать все
          </Button>
          <Button variant="outline" size="sm" onClick={onSelectNone}>
            Снять все
          </Button>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {sections.map((section) => (
          <Card key={section.id} className={`border ${section.selected ? 'border-primary' : 'border-border'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  checked={section.selected}
                  onCheckedChange={(checked) => onSectionToggle(section.id, checked as boolean)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={getTypeColor(section.type)}>
                      {section.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Страницы: {section.pageNumbers.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded text-truncate max-h-20 overflow-hidden">
                {section.content.substring(0, 200)}...
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={onProceedToExtraction}
        disabled={selectedCount === 0 || isProcessing}
        className="w-full"
        size="lg"
      >
        <Play className="mr-2 h-4 w-4" />
        Извлечь данные из выбранных секций ({selectedCount})
      </Button>
    </div>
  );
};