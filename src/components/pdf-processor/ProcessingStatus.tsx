import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ProcessingStatus as Status } from './types';
import { 
  Upload, 
  FileText, 
  Brain, 
  CheckSquare, 
  Database, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';

interface ProcessingStatusProps {
  status: Status;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ status }) => {
  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'upload': return <Upload className="h-4 w-4" />;
      case 'extract': return <FileText className="h-4 w-4" />;
      case 'analyze': return <Brain className="h-4 w-4" />;
      case 'select': return <CheckSquare className="h-4 w-4" />;
      case 'extract_data': return <Database className="h-4 w-4" />;
      case 'complete': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'complete': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getStageName = (stage: string) => {
    switch (stage) {
      case 'upload': return 'Загрузка файла';
      case 'extract': return 'Извлечение текста';
      case 'analyze': return 'Анализ структуры';
      case 'select': return 'Выбор секций';
      case 'extract_data': return 'Извлечение данных';
      case 'complete': return 'Завершено';
      case 'error': return 'Ошибка';
      default: return 'Обработка';
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {getStageIcon(status.stage)}
            <span className="font-medium">{getStageName(status.stage)}</span>
          </div>
          <Badge className={getStageColor(status.stage)}>
            {Math.round(status.progress)}%
          </Badge>
        </div>
        
        <Progress value={status.progress} className="mb-2" />
        
        <p className="text-sm text-muted-foreground">
          {status.message}
        </p>
      </CardContent>
    </Card>
  );
};