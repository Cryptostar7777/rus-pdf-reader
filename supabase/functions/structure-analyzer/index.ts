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

    const { text, total_pages } = await req.json();
    
    if (!text || text.trim() === '') {
      throw new Error('Текст не может быть пустым');
    }

    console.log(`🔍 Анализ структуры PDF: ${total_pages} страниц, ${text.length} символов`);

    const prompt = `Проанализируй техническую документацию и найди ВСЕ таблицы, спецификации, ведомости с МАКСИМАЛЬНОЙ точностью.

КРИТИЧЕСКИ ВАЖНО: верни результат СТРОГО в JSON формате без дополнительных комментариев:
{
  "found_tables": [
    {
      "title": "точное название таблицы/раздела",
      "type": "спецификация|ведомость|характеристики|таблица",
      "content": "первые 3-5 строк таблицы для идентификации",
      "pageNumbers": [номера страниц где найдена таблица],
      "pageRange": {
        "start": первая_страница_секции,
        "end": последняя_страница_секции
      },
      "estimatedRows": примерное_количество_строк_в_таблице,
      "complexity": "simple|medium|complex"
    }
  ],
  "total_pages": ${total_pages},
  "document_type": "тип документа",
  "summary": "краткое описание найденных структур",
  "processing_strategy": {
    "total_sections": количество_найденных_секций,
    "large_sections": количество_секций_больше_15_страниц,
    "recommended_chunks": рекомендуемое_количество_частей_для_обработки
  }
}

ПРАВИЛА АНАЛИЗА:
1. Ищи ВСЕ таблицы, спецификации, ведомости без исключения
2. Определяй ТОЧНЫЕ границы каждой таблицы (начало и конец)
3. Указывай диапазон страниц для каждой секции
4. Оценивай сложность и размер каждой таблицы
5. НЕ объединяй разные таблицы в одну
6. Планируй стратегию обработки для больших секций

Текст документа: ${text}`;

    const maxAttempts = 3;
    let result = '';
    
    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      console.log(`🔄 Попытка анализа ${attempts} из ${maxAttempts}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini-2025-04-14',
          messages: [
            { 
              role: 'system', 
              content: 'Ты эксперт по анализу структуры технических документов. КРИТИЧНО: ВСЕГДА возвращай ПОЛНЫЙ JSON без сокращений. Ищи ВСЕ таблицы и секции максимально точно!' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.01,
          max_tokens: 8000, // УВЕЛИЧЕНО для полного анализа структуры
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

      console.log(`📄 Результат анализа получен, длина: ${result.length} символов`);

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
        if (!parsed.found_tables || !Array.isArray(parsed.found_tables)) {
          throw new Error('Некорректная структура: отсутствует found_tables');
        }
        
        console.log(`✅ Найдено секций: ${parsed.found_tables.length}`);
        result = cleanResult;
        break;
        
      } catch (parseError) {
        console.error(`❌ Ошибка парсинга JSON на попытке ${attempts}:`, parseError.message);
        
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
    console.error('❌ Ошибка в structure-analyzer:', error);
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