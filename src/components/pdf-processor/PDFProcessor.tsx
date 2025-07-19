import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  PageText, 
  StructureAnalysis, 
  TableSection, 
  ExtractionResult, 
  ProcessingStatus as Status 
} from './types';
import { FileUploader } from './FileUploader';
import { TextExtractor } from './TextExtractor';
import { StructureAnalyzer } from './StructureAnalyzer';
import { SectionSelector } from './SectionSelector';
import { PrecisionExtractor } from './PrecisionExtractor';
import { ProcessingStatus } from './ProcessingStatus';
import { ResultsDisplay } from './ResultsDisplay';
import { SystemDiagnostics } from './SystemDiagnostics';

export const PDFProcessor: React.FC = () => {
  // Основные состояния
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<PageText[]>([]);
  const [structureAnalysis, setStructureAnalysis] = useState<StructureAnalysis | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractionResult | null>(null);
  
  // Состояния обработки
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<Status['stage']>('upload');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Загрузите PDF файл для начала');
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  // Обработчики файла
  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    resetStates();
    if (file) {
      setCurrentStage('extract');
      setStatusMessage('Файл загружен. Готов к извлечению текста.');
      setProgress(10);
    } else {
      setCurrentStage('upload');
      setStatusMessage('Загрузите PDF файл для начала');
      setProgress(0);
    }
  };

  const resetStates = () => {
    setExtractedText([]);
    setStructureAnalysis(null);
    setExtractedData(null);
    setError(null);
    setIsProcessing(false);
  };

  // Обработчики извлечения текста
  const handleTextExtracted = (text: PageText[]) => {
    setExtractedText(text);
    setCurrentStage('analyze');
    setProgress(30);
    setStatusMessage(`Текст извлечен с ${text.length} страниц. Готов к анализу структуры.`);
    
    toast({
      title: "Текст извлечен",
      description: `Обработано ${text.length} страниц`,
    });
  };

  const handleTextExtractionStart = () => {
    setIsProcessing(true);
    setCurrentStage('extract');
    setError(null);
  };

  const handleTextExtractionError = (error: string) => {
    setIsProcessing(false);
    setCurrentStage('error');
    setError(error);
    setStatusMessage(`Ошибка извлечения: ${error}`);
    setProgress(0);
  };

  // Обработчики анализа структуры
  const handleAnalysisComplete = (analysis: StructureAnalysis) => {
    setStructureAnalysis(analysis);
    setCurrentStage('select');
    setProgress(60);
    setStatusMessage(`Найдено ${analysis.found_tables?.length || 0} таблиц. Выберите секции для извлечения.`);
  };

  const handleAnalysisStart = () => {
    setIsProcessing(true);
    setCurrentStage('analyze');
    setError(null);
  };

  const handleAnalysisError = (error: string) => {
    setIsProcessing(false);
    setCurrentStage('error');
    setError(error);
    setStatusMessage(`Ошибка анализа: ${error}`);
  };

  // Обработчики выбора секций
  const handleSectionToggle = (sectionId: string, selected: boolean) => {
    if (!structureAnalysis) return;
    
    const updatedTables = structureAnalysis.found_tables.map(table =>
      table.id === sectionId ? { ...table, selected } : table
    );
    
    setStructureAnalysis({
      ...structureAnalysis,
      found_tables: updatedTables
    });
  };

  const handleSelectAll = () => {
    if (!structureAnalysis) return;
    
    const updatedTables = structureAnalysis.found_tables.map(table => ({
      ...table,
      selected: true
    }));
    
    setStructureAnalysis({
      ...structureAnalysis,
      found_tables: updatedTables
    });
  };

  const handleSelectNone = () => {
    if (!structureAnalysis) return;
    
    const updatedTables = structureAnalysis.found_tables.map(table => ({
      ...table,
      selected: false
    }));
    
    setStructureAnalysis({
      ...structureAnalysis,
      found_tables: updatedTables
    });
  };

  const handleProceedToExtraction = async () => {
    const selectedSections = getSelectedSections();
    if (selectedSections.length === 0) return;
    
    setIsProcessing(true);
    setCurrentStage('extract_data');
    setProgress(70);
    setStatusMessage('Получение полного контента выбранных разделов...');
    
    try {
      // Получаем полный контент для каждого выбранного раздела
      const sectionsWithFullContent = await Promise.all(
        selectedSections.map(async (section) => {
          if (section.fullContent) return section;
          
          // Получаем страницы в диапазоне раздела
          const relevantPages = extractedText.filter(page => 
            page.pageNumber >= section.pageRange.start && 
            page.pageNumber <= section.pageRange.end
          );
          
          const fullContent = relevantPages.map(page => page.text).join('\n\n');
          
          return {
            ...section,
            fullContent
          };
        })
      );
      
      // Обновляем структурный анализ с полным контентом
      if (structureAnalysis) {
        const updatedAnalysis = {
          ...structureAnalysis,
          found_tables: structureAnalysis.found_tables.map(table => {
            const updatedSection = sectionsWithFullContent.find(s => s.id === table.id);
            return updatedSection || table;
          })
        };
        setStructureAnalysis(updatedAnalysis);
      }
      
      setProgress(80);
      setStatusMessage('Готов к извлечению структурированных данных');
    } catch (error) {
      console.error('Ошибка получения полного контента:', error);
      setError('Ошибка при получении полного контента разделов');
    } finally {
      setIsProcessing(false);
    }
  };

  // Обработчики извлечения данных
  const handleExtractionComplete = (data: ExtractionResult) => {
    setExtractedData(data);
    setCurrentStage('complete');
    setProgress(100);
    setStatusMessage(`Успешно извлечено ${data.extracted_items?.length || 0} позиций`);
    setIsProcessing(false);
  };

  const handleExtractionStart = () => {
    setIsProcessing(true);
    setCurrentStage('extract_data');
    setError(null);
  };

  const handleExtractionError = (error: string) => {
    setIsProcessing(false);
    setCurrentStage('error');
    setError(error);
    setStatusMessage(`Ошибка извлечения данных: ${error}`);
  };

  // Общий обработчик изменения статуса
  const handleStatusChange = (message: string) => {
    setStatusMessage(message);
  };

  // Получение текущего статуса
  const getCurrentStatus = (): Status => ({
    stage: currentStage,
    message: statusMessage,
    progress: progress
  });

  // Получение выбранных секций
  const getSelectedSections = (): TableSection[] => {
    return structureAnalysis?.found_tables.filter(table => table.selected) || [];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Системная диагностика */}
      <SystemDiagnostics />
      
      <ProcessingStatus status={getCurrentStatus()} />

      {/* Шаг 1: Загрузка файла */}
      <FileUploader
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        isProcessing={isProcessing}
        error={error}
      />

      {/* Шаг 2: Извлечение текста */}
      {selectedFile && (
        <TextExtractor
          selectedFile={selectedFile}
          onTextExtracted={handleTextExtracted}
          isProcessing={isProcessing && currentStage === 'extract'}
          progress={progress}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Шаг 3: Анализ структуры */}
      {extractedText.length > 0 && (
        <StructureAnalyzer
          extractedText={extractedText}
          structureAnalysis={structureAnalysis}
          onAnalysisComplete={handleAnalysisComplete}
          isProcessing={isProcessing && currentStage === 'analyze'}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Шаг 4: Выбор секций */}
      {structureAnalysis && structureAnalysis.found_tables.length > 0 && (
        <SectionSelector
          sections={structureAnalysis.found_tables}
          onSectionToggle={handleSectionToggle}
          onSelectAll={handleSelectAll}
          onSelectNone={handleSelectNone}
          onProceedToExtraction={handleProceedToExtraction}
          isProcessing={isProcessing}
        />
      )}

      {/* Шаг 5: Извлечение данных */}
      {currentStage === 'extract_data' || currentStage === 'complete' ? (
        <PrecisionExtractor
          selectedSections={getSelectedSections()}
          pdfPages={extractedText}
          onExtractionComplete={handleExtractionComplete}
          onStatusChange={handleStatusChange}
        />
      ) : null}

      {/* Отображение результатов на каждом шаге */}
      <ResultsDisplay
        extractedText={extractedText}
        structureAnalysis={structureAnalysis}
        extractionResult={extractedData}
        currentStage={currentStage}
      />
    </div>
  );
};