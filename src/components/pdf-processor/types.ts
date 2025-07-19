export interface PageText {
  pageNumber: number;
  text: string;
}

export interface TableSection {
  id: string;
  title: string;
  type: 'спецификация' | 'ведомость' | 'характеристики' | 'таблица';
  content: string;
  fullContent?: string; // Полный контент раздела для извлечения
  pageNumbers: number[];
  pageRange: { start: number; end: number }; // Диапазон страниц для получения полного контента
  selected: boolean;
}

export interface StructureAnalysis {
  found_tables: TableSection[];
  total_pages: number;
  document_type: string;
  summary: string;
}

export interface ExtractedItem {
  "Наименование системы": string;
  "Наименование раздела": string;
  "Наименование": string;
  "Технические характеристики": string;
  "Тип, марка, обозначение": string;
  "Код изделия": string;
  "Завод изготовитель": string;
  "Ед измерения": string;
  "Количество": string;
  "Категория": string;
  "Примечание": string;
}

export interface ExtractionResult {
  extracted_items: ExtractedItem[];
  summary: {
    total_items: number;
    systems_found: string[];
    sections_processed: string[];
    duplicates_removed?: number;
    validation?: {
      warnings: string[];
      stats: {
        items_with_missing_fields: number;
        items_without_quantity: number;
        items_without_manufacturer: number;
        systems_coverage: number;
      };
    };
  };
  processing_info?: {
    chunks_processed: number;
    successful_chunks: number;
    failed_chunks: number;
    processing_notes: string[];
    timestamp: string;
  };
}

export interface ProcessingStatus {
  stage: 'upload' | 'extract' | 'analyze' | 'select' | 'extract_data' | 'complete' | 'error';
  message: string;
  progress: number;
}