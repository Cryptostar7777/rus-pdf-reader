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

    const { text, mode = 'test', sections_info } = await req.json();
    
    if (!text || text.trim() === '') {
      throw new Error('Текст не может быть пустым');
    }

    console.log(`AI обработка в режиме ${mode}, длина текста: ${text.length} символов`);

    let prompt = '';
    
    if (mode === 'test') {
      prompt = `Это тестовый запрос. Ответь: "AI интеграция работает корректно. Модель: GPT-4.1-2025-04-14"`;
    
    } else if (mode === 'analyze_structure') {
      prompt = `Проанализируй техническую документацию и найди все таблицы, спецификации, ведомости с максимальной точностью.
      
      КРИТИЧЕСКИ ВАЖНО: верни результат СТРОГО в JSON формате без дополнительных комментариев:
      {
        "found_tables": [
          {
            "title": "точное название таблицы/раздела",
            "type": "спецификация|ведомость|характеристики|таблица",
            "content": "полный текст найденной таблицы/секции",
            "pageNumbers": [номера страниц где найдена таблица]
          }
        ],
        "total_pages": общее_количество_страниц,
        "document_type": "тип документа",
        "summary": "краткое описание найденных структур"
      }
      
      ПРАВИЛА АНАЛИЗА:
      1. Ищи ВСЕ таблицы, спецификации, ведомости без исключения
      2. Определяй точные границы каждой таблицы
      3. Указывай страницы где найдена каждая таблица
      4. НЕ объединяй разные таблицы в одну
      5. Сохраняй полный контент каждой найденной структуры
      
      Текст документа: ${text}`;
    
    } else if (mode === 'extract_structured') {
      const sectionsDesc = sections_info ? 
        sections_info.map((s: any) => `- ${s.title} (${s.type}, страницы: ${s.pageNumbers.join(', ')})`).join('\n') : 
        'Все найденные секции';
        
      prompt = `КРИТИЧЕСКАЯ ЗАДАЧА: Извлеки АБСОЛЮТНО ВСЕ позиции оборудования, материалов и изделий из предоставленных секций документа.

        ОБРАБАТЫВАЕМЫЕ СЕКЦИИ:
        ${sectionsDesc}

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
          "summary": {
            "total_items": количество_извлеченных_позиций,
            "systems_found": ["список найденных систем"],
            "sections_processed": ["список обработанных секций"]
          }
        }

        СТРОГИЕ ПРАВИЛА:
        1. ВОЗВРАЩАЙ ТОЛЬКО ЧИСТЫЙ JSON БЕЗ MARKDOWN И КОММЕНТАРИЕВ!
        2. ИЗВЛЕКАЙ КАЖДУЮ ПОЗИЦИЮ - никаких сокращений!
        3. НИКОГДА не пиши "далее по аналогии", "и т.д.", "..." 
        4. ЗАПОЛНЯЙ ВСЕ ПОЛЯ максимально точно
        5. ПРАВИЛЬНО ЗАВЕРШАЙ JSON - все скобки должны быть закрыты!

        Текст секций: ${text}`;
    
    } else {
      throw new Error(`Неподдерживаемый режим: ${mode}`);
    }

    // Вызов OpenAI API
    const maxAttempts = 3;
    let result = '';
    let tokensUsed: any = {};
    
    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      console.log(`🔄 Попытка ${attempts} из ${maxAttempts}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            { 
              role: 'system', 
              content: 'Ты супер-точный экстрактор данных для технических документов. КРИТИЧНО: ВСЕГДА возвращай ПОЛНЫЙ результат в правильном JSON формате. НИКОГДА не сокращай списки и не пиши "и т.д.". ИЗВЛЕКАЙ ВСЕ позиции без исключения!' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.01,
          max_tokens: 50000,
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
      tokensUsed = data.usage;

      console.log(`📄 AI ответ получен, длина: ${result.length} символов`);

      // Валидация JSON для структурированных режимов
      if (mode === 'analyze_structure' || mode === 'extract_structured') {
        try {
          // Попытка очистить результат от markdown
          let cleanResult = result;
          if (result.includes('```json')) {
            cleanResult = result.split('```json')[1].split('```')[0].trim();
          } else if (result.includes('```')) {
            cleanResult = result.split('```')[1].split('```')[0].trim();
          }

          const parsed = JSON.parse(cleanResult);
          console.log('✅ JSON валидация прошла успешно');
          result = cleanResult;
          break;
        } catch (parseError) {
          console.error(`❌ Ошибка парсинга JSON на попытке ${attempts}:`, parseError.message);
          console.error(`❌ Проблемный ответ (первые 500 символов):`, result.substring(0, 500));
          console.error(`❌ Проблемный ответ (последние 200 символов):`, result.slice(-200));
          
          if (attempts === maxAttempts) {
            // В случае последней попытки, попробуем найти JSON в ответе
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                JSON.parse(jsonMatch[0]);
                result = jsonMatch[0];
                console.log('✅ Найден и извлечен валидный JSON из ответа');
                break;
              } catch {
                // Если и это не помогло, возвращаем ошибку
                throw new Error('Получен некорректный JSON после всех попыток');
              }
            } else {
              throw new Error('JSON не найден в ответе AI');
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      } else {
        break;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      result: result,
      mode,
      text_length: text.length,
      tokens_used: tokensUsed,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Ошибка в AI text processor:', error);
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