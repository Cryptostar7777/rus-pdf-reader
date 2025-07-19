import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chunks_results, validation_info } = await req.json();
    
    if (!chunks_results || !Array.isArray(chunks_results)) {
      throw new Error('chunks_results должен быть массивом');
    }

    console.log(`🔄 Обработка результатов: ${chunks_results.length} частей`);

    // Объединение всех извлеченных позиций
    const allItems: any[] = [];
    const processingNotes: string[] = [];
    const sectionsProcessed: string[] = [];
    
    for (const chunk of chunks_results) {
      if (chunk.success && chunk.result) {
        try {
          const parsed = JSON.parse(chunk.result);
          
          if (parsed.extracted_items && Array.isArray(parsed.extracted_items)) {
            allItems.push(...parsed.extracted_items);
          }
          
          if (parsed.chunk_info?.section_title) {
            sectionsProcessed.push(parsed.chunk_info.section_title);
          }
          
          if (parsed.processing_notes && Array.isArray(parsed.processing_notes)) {
            processingNotes.push(...parsed.processing_notes);
          }
          
        } catch (parseError) {
          console.error('Ошибка парсинга chunk result:', parseError);
          processingNotes.push(`Ошибка обработки одной из частей: ${parseError.message}`);
        }
      } else {
        processingNotes.push(`Ошибка в одной из частей: ${chunk.error || 'Неизвестная ошибка'}`);
      }
    }

    console.log(`📊 Всего позиций после объединения: ${allItems.length}`);

    // Удаление дубликатов
    const uniqueItems = removeDuplicates(allItems);
    console.log(`🔄 После удаления дубликатов: ${uniqueItems.length}`);

    // Группировка по системам
    const systemsFound = [...new Set(uniqueItems.map(item => item["Наименование системы"]).filter(Boolean))];
    
    // Валидация полноты
    const validationResults = validateCompleteness(uniqueItems, validation_info);

    // Формирование финального результата
    const finalResult = {
      extracted_items: uniqueItems,
      summary: {
        total_items: uniqueItems.length,
        systems_found: systemsFound,
        sections_processed: [...new Set(sectionsProcessed)],
        duplicates_removed: allItems.length - uniqueItems.length,
        validation: validationResults
      },
      processing_info: {
        chunks_processed: chunks_results.length,
        successful_chunks: chunks_results.filter(c => c.success).length,
        failed_chunks: chunks_results.filter(c => !c.success).length,
        processing_notes: processingNotes,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`✅ Финальный результат готов: ${finalResult.summary.total_items} позиций`);

    return new Response(JSON.stringify({
      success: true,
      result: finalResult,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Ошибка в result-processor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Функция удаления дубликатов
function removeDuplicates(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter(item => {
    // Создаем уникальный ключ на основе названия и характеристик
    const key = `${item["Наименование"] || ''}_${item["Тип, марка, обозначение"] || ''}_${item["Код изделия"] || ''}`.toLowerCase();
    
    if (seen.has(key)) {
      return false; // Дубликат
    }
    
    seen.add(key);
    return true;
  });
}

// Функция валидации полноты
function validateCompleteness(items: any[], validationInfo: any) {
  const validation = {
    warnings: [] as string[],
    stats: {
      items_with_missing_fields: 0,
      items_without_quantity: 0,
      items_without_manufacturer: 0,
      systems_coverage: 0
    }
  };

  // Проверка заполненности полей
  items.forEach(item => {
    const missingFields: string[] = [];
    
    if (!item["Наименование"] || item["Наименование"].trim() === '') {
      missingFields.push("Наименование");
    }
    
    if (!item["Количество"] || item["Количество"].trim() === '') {
      validation.stats.items_without_quantity++;
    }
    
    if (!item["Завод изготовитель"] || item["Завод изготовитель"].trim() === '') {
      validation.stats.items_without_manufacturer++;
    }
    
    if (missingFields.length > 0) {
      validation.stats.items_with_missing_fields++;
    }
  });

  // Проверка ожидаемого количества
  if (validationInfo?.expected_minimum_items) {
    if (items.length < validationInfo.expected_minimum_items) {
      validation.warnings.push(`Извлечено ${items.length} позиций, ожидалось минимум ${validationInfo.expected_minimum_items}`);
    }
  }

  // Проверка систем
  const systemsFound = new Set(items.map(item => item["Наименование системы"]).filter(Boolean));
  validation.stats.systems_coverage = systemsFound.size;

  if (validation.stats.items_without_quantity > items.length * 0.1) {
    validation.warnings.push(`Слишком много позиций без количества: ${validation.stats.items_without_quantity}`);
  }

  return validation;
}