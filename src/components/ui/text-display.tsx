import React from 'react';
import { ScrollArea } from './scroll-area';
import { Card } from './card';
import { FileText, Copy } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PageText {
  pageNumber: number;
  text: string;
}

interface TextDisplayProps {
  pages: PageText[];
  className?: string;
  fileName?: string;
}

export const TextDisplay: React.FC<TextDisplayProps> = ({
  pages,
  className,
  fileName
}) => {
  const { toast } = useToast();

  const copyPageText = (text: string, pageNumber: number) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Текст скопирован",
      description: `Текст со страницы ${pageNumber} скопирован в буфер обмена`,
    });
  };

  const copyAllText = () => {
    const allText = pages.map(page => 
      `=== СТРАНИЦА ${page.pageNumber} ===\n${page.text}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(allText);
    toast({
      title: "Весь текст скопирован",
      description: `Текст из ${pages.length} страниц скопирован в буфер обмена`,
    });
  };

  if (pages.length === 0) {
    return null;
  }

  return (
    <Card className={cn("bg-gradient-surface shadow-elegant", className)}>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <FileText className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">
                Извлеченный текст
              </h3>
              <p className="text-sm text-muted-foreground">
                {fileName && `${fileName} • `}{pages.length} страниц
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyAllText}
            className="flex items-center space-x-2"
          >
            <Copy className="h-4 w-4" />
            <span>Копировать всё</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="h-96">
        <div className="p-6 space-y-6">
          {pages.map((page) => (
            <div
              key={page.pageNumber}
              className="border border-border rounded-lg p-4 bg-card"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-card-foreground">
                  Страница {page.pageNumber}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyPageText(page.text, page.pageNumber)}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-card-foreground whitespace-pre-wrap leading-relaxed">
                {page.text || (
                  <span className="text-muted-foreground italic">
                    Текст на этой странице не найден
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};