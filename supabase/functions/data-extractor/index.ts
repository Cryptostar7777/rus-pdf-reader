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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY не настроен в секретах');
    }

    const { text, section_info, chunk_index = 0, total_chunks = 1 } = await req.json();
    
    if (!text || text.trim() === '') {
      throw new Error('Текст не может быть пустым');
    }

    console.log(`🔄 Извлечение данных: часть ${chunk_index + 1}/${total_chunks}, ${text.length} символов`);

    const prompt = `КРИТИЧЕСКАЯ ЗАДАЧА: Извлеки АБСОЛЮТНО ВСЕ позиции оборудования, материалов и изделий из предоставленной секции документа.

ИНФОРМАЦИЯ О СЕКЦИИ:
- Название: ${section_info?.title || 'Не указано'}
- Тип: ${section_info?.type || 'Не указан'}
- Часть: ${chunk_index + 1} из ${total_chunks}
- Страницы: ${section_info?.pageNumbers?.join(', ') || 'Не указаны'}

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ JSON (СТРОГО БЕЗ КОММЕНТАРИЕВ):
{
  "extracted_items": [
    {
      "Наименование системы": "код системы (П1, В1, В2, ОВ и т.д.)", 
      "Наименование раздела": "Вентиляция/Отопление/Холодоснабжение", 
      "Наименование": "полное название оборудования/материала", 
      "Технические характеристики": "все технические параметры", 
      "Тип, марка, обозначение": "марка/модель", 
      "Код изделия": "артикул/код", 
      "Завод изготовитель": "производитель", 
      "Ед измерения": "шт./м/кг/м2 и т.д.", 
      "Количество": "точное количество", 
      "Категория": "Оборудование/Материалы/Изделия", 
      "Примечание": "дополнительная информация"
    }
  ],
  "chunk_info": {
    "chunk_index": ${chunk_index},
    "total_chunks": ${total_chunks},
    "items_found": количество_найденных_позиций,
    "section_title": "${section_info?.title || 'Неизвестная секция'}"
  },
  "processing_notes": [
    "важные замечания о процессе извлечения"
  ]
}

СТРОГИЕ ПРАВИЛА:
1. ВОЗВРАЩАЙ ТОЛЬКО ЧИСТЫЙ JSON БЕЗ MARKDOWN И КОММЕНТАРИЕВ!
2. ИЗВЛЕКАЙ КАЖДУЮ ПОЗИЦИЮ - никаких сокращений!
3. НИКОГДА не пиши "далее по аналогии", "и т.д.", "..." 
4. ЗАПОЛНЯЙ ВСЕ ПОЛЯ максимально точно
5. ПРАВИЛЬНО ЗАВЕРШАЙ JSON - все скобки должны быть закрыты!
6. Если это часть большой секции - извлекай только из предоставленного текста

Текст секции: ${text}`;

    const maxAttempts = 3;
    let result = '';
    
    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      console.log(`🔄 Попытка извлечения ${attempts} из ${maxAttempts}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini-2025-04-14', // Быстрая модель для извлечения
          messages: [
            { 
              role: 'system', 
              content: 'Ты супер-точный экстрактор данных для технических документов. КРИТИЧНО: ВСЕГДА возвращай ПОЛНЫЙ результат в правильном JSON формате. НИКОГДА не сокращай списки и не пиши "и т.д.". ИЗВЛЕКАЙ ВСЕ позиции без исключения!' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.01,
          max_tokens: 16000, // УВЕЛИЧЕНО для полного извлечения больших таблиц
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ OpenAI API error:', errorData);
        
        if (attempts === maxAttempts) {
          throw new Error(`OpenAI API ошибка: ${errorData.error?.message || 'Неизвестная ошибка'}`);
        }
        
        console.log(`🔄 Retry after API error, attempt ${attempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
        continue;
      }

      const data = await response.json();
      result = data.choices[0].message.content;

      console.log(`📄 Результат извлечения получен, длина: ${result.length} символов`);

      // Валидация JSON
      try {
        let cleanResult = result;
        if (result.includes('```json')) {
          cleanResult = result.split('```json')[1].split('```')[0].trim();
        } else if (result.includes('```')) {
          cleanResult = result.split('```')[1].split('```')[0].trim();
        }

        const parsed = JSON.parse(cleanResult);
        
        // Валидация структуры
        if (!parsed.extracted_items || !Array.isArray(parsed.extracted_items)) {
          throw new Error('Некорректная структура: отсутствует extracted_items');
        }
        
        console.log(`✅ Извлечено позиций: ${parsed.extracted_items.length}`);
        result = cleanResult;
        break;
        
      } catch (parseError) {
        console.error(`❌ Ошибка парсинга JSON на попытке ${attempts}:`, parseError.message);
        console.error(`❌ Проблемный ответ (первые 500 символов):`, result.substring(0, 500));
        
        if (attempts === maxAttempts) {
          // Попытка извлечь JSON из ответа
          const jsonMatch = result.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              JSON.parse(jsonMatch[0]);
              result = jsonMatch[0];
              console.log('✅ Найден и извлечен валидный JSON из ответа');
              break;
            } catch {
              throw new Error('Получен некорректный JSON после всех попыток');
            }
          } else {
            throw new Error('JSON не найден в ответе AI');
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Ошибка в data-extractor:', error);
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