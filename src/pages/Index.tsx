import { PDFProcessor } from '@/components/pdf-processor/PDFProcessor';
import { FileText, Zap, Shield, Download } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Заголовок */}
      <div className="bg-gradient-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white/10 rounded-2xl">
                <FileText className="h-12 w-12" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              PDF Парсер
            </h1>
            <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
              Быстрое и точное извлечение текста из PDF документов на русском языке
            </p>
          </div>
        </div>
      </div>

      {/* Основное содержимое */}
      <div className="container mx-auto px-4 py-12">
        <PDFProcessor />
      </div>

      {/* Преимущества */}
      <div className="bg-card shadow-card border-t border-border">
        <div className="container mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-center text-card-foreground mb-8">
            Преимущества нашего парсера
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-card-foreground">Быстрая обработка</h3>
              <p className="text-muted-foreground text-sm">
                Мгновенное извлечение текста из PDF файлов любого размера
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-card-foreground">Полная безопасность</h3>
              <p className="text-muted-foreground text-sm">
                Обработка происходит локально в браузере, файлы не загружаются на сервер
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Download className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-card-foreground">Сохранение результатов</h3>
              <p className="text-muted-foreground text-sm">
                Возможность скачать извлеченный текст в виде текстового файла
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
