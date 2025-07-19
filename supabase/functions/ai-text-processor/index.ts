import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY не настроен в секретах');
    }

    const { text, mode = 'test', chunkIndex = 0, totalChunks = 1 } = await req.json();
    
    if (!text || text.trim() === '') {
      throw new Error('Текст не может быть пустым');
    }

    console.log(`AI обработка в режиме ${mode}, длина текста: ${text.length} символов`);

    let prompt = '';
    if (mode === 'test') {
      prompt = `Ответь коротко: получен ли текст и сколько в нем символов? Текст: "${text.substring(0, 100)}..."`;
    } else if (mode === 'extract') {
      prompt = `Найди в тексте спецификации, ведомости материалов, таблицы с техническими характеристиками. 
      Верни результат в формате JSON со структурой:
      {
        "found_tables": [
          {
            "title": "название таблицы/раздела",
            "type": "спецификация|ведомость|характеристики",
            "content": "найденный текст таблицы"
          }
        ]
      }
      
      Текст документа: ${text}`;
    } else if (mode === 'structured') {
      prompt = `КРИТИЧЕСКАЯ ЗАДАЧА: Извлеки АБСОЛЮТНО ВСЕ позиции из технических документов для коммерческого предложения.

      ВАЖНО: ЭТО ЧАСТЬ ${chunkIndex + 1} ИЗ ${totalChunks}. ИЗВЛЕКАЙ ТОЛЬКО ПОЗИЦИИ ИЗ ЭТОЙ ЧАСТИ!

      ОБЯЗАТЕЛЬНЫЙ ФОРМАТ JSON:
      {
        "extracted_items": [
          {
            "Наименование системы": "П1", 
            "Наименование раздела": "Вентиляция", 
            "Наименование": "Вентилятор радиальный", 
            "Технические характеристики": "VTR 45B 1.1x15 EX.C KR L 0 У1", 
            "Тип, марка, обозначение": "VTR 45B", 
            "Код изделия": "1", 
            "Завод изготовитель": "NED", 
            "Ед измерения": "шт.", 
            "Количество": "1", 
            "Категория": "Оборудование", 
            "Примечание": ""
          }
        ],
        "chunk_info": {
          "chunk_index": ${chunkIndex},
          "total_chunks": ${totalChunks},
          "items_in_chunk": 0
        }
      }

      СТРОГИЕ ПРАВИЛА:
      1. ВОЗВРАЩАЙ ТОЛЬКО JSON БЕЗ КОММЕНТАРИЕВ!
      2. ИЗВЛЕКАЙ КАЖДУЮ ПОЗИЦИЮ ИЗ ЭТОЙ ЧАСТИ - никаких сокращений!
      3. НИКОГДА не пиши "далее по аналогии", "и т.д.", "..." 
      4. ЗАПОЛНЯЙ items_in_chunk с точным количеством позиций в этой части
      5. НЕ ДОБАВЛЯЙ summary - только для последней части!

      ПРАВИЛА ИЗВЛЕЧЕНИЯ:
      - "Наименование системы": код системы (П1, В1, В2, ОВ, и т.д.)
      - "Наименование раздела": Вентиляция/Отопление/Холодоснабжение
      - "Наименование": краткое название оборудования
      - "Технические характеристики": ПОЛНАЯ техническая спецификация
      - "Тип, марка, обозначение": точная марка/модель
      - "Код изделия": номер позиции из спецификации
      - "Завод изготовитель": производитель
      - "Ед измерения": шт./кг/м/м2/м3/пар
      - "Количество": точное количество
      - "Категория": Оборудование/Изделия/Материалы
      - "Примечание": дополнительная информация

      Анализируй ТОЛЬКО этот фрагмент текста и извлекай КАЖДУЮ позицию:
      
      ${text}`;
    } else if (mode === 'structured_complete') {
      // Для полного извлечения разбиваем большие документы на секции
      const maxTextLength = 20000;
      
      if (text.length > maxTextLength) {
        console.log(`📊 Документ большой (${text.length} символов), используем секционную обработку`);
        
        // Разбиваем текст на логические секции по системам
        const sections = text.split(/(?=\n\s*[ПВА]\d+[а-я]?\s+)/);
        const allItems: any[] = [];
        let totalTokens = 0;
        
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          if (section.trim().length < 200) continue; // Пропускаем слишком короткие секции
          
          console.log(`🔄 Обрабатываем секцию ${i + 1}/${sections.length}, длина: ${section.length} символов`);
          
          const sectionPrompt = `Извлеки ВСЕ позиции из этой секции документа спецификации в формате JSON:

{
  "extracted_items": [
    {
      "Наименование системы": "название системы",
      "Наименование раздела": "раздел",
      "Наименование": "полное наименование",
      "Технические характеристики": "полные характеристики",
      "Тип, марка, обозначение": "тип/марка",
      "Код изделия": "код позиции",
      "Завод изготовитель": "производитель",
      "Ед измерения": "единица измерения",
      "Количество": "количество",
      "Категория": "Оборудование/Изделия/Материалы",
      "Примечание": "примечания"
    }
  ]
}

КРИТИЧНО: Извлеки КАЖДУЮ позицию из этой секции. НЕ СОКРАЩАЙ НИЧЕГО!

СЕКЦИЯ ДОКУМЕНТА:
${section}`;

          try {
            const sectionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                    content: 'Ты эксперт по извлечению данных из технических документов. КРИТИЧНО: извлекай каждую позицию полностью, никаких сокращений!'
                  },
                  { role: 'user', content: sectionPrompt }
                ],
                temperature: 0.01,
                max_tokens: 8000,
              }),
            });

            if (!sectionResponse.ok) {
              console.error(`❌ Ошибка API для секции ${i + 1}:`, sectionResponse.status);
              continue;
            }

            const sectionData = await sectionResponse.json();
            totalTokens += sectionData.usage?.total_tokens || 0;
            
            const sectionResult = sectionData.choices[0].message.content;
            
            try {
              // Очищаем ответ от markdown форматирования
              let cleanedResult = sectionResult.trim();
              
              // Удаляем markdown блоки ```json и ```
              if (cleanedResult.startsWith('```json')) {
                cleanedResult = cleanedResult.replace(/^```json\s*/, '').replace(/\s*```\s*$/, '');
              } else if (cleanedResult.startsWith('```')) {
                cleanedResult = cleanedResult.replace(/^```\s*/, '').replace(/\s*```\s*$/, '');
              }
              
              const sectionJson = JSON.parse(cleanedResult);
              if (sectionJson.extracted_items && Array.isArray(sectionJson.extracted_items)) {
                allItems.push(...sectionJson.extracted_items);
                console.log(`✅ Извлечено ${sectionJson.extracted_items.length} позиций из секции ${i + 1}`);
              }
            } catch (parseError) {
              console.error(`❌ Ошибка парсинга JSON для секции ${i + 1}:`, parseError);
              console.error(`❌ Проблемный ответ:`, sectionResult.substring(0, 200) + '...');
            }
            
            // Пауза между запросами
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.error(`❌ Ошибка обработки секции ${i + 1}:`, error);
          }
        }
        
        console.log(`✅ Общее количество извлеченных позиций: ${allItems.length}`);
        
        // Группируем по категориям
        const categories = {
          "Оборудование": allItems.filter(item => item["Категория"] === "Оборудование").length,
          "Изделия": allItems.filter(item => item["Категория"] === "Изделия").length,
          "Материалы": allItems.filter(item => item["Категория"] === "Материалы").length
        };
        
        const systems = [...new Set(allItems.map(item => item["Наименование системы"]).filter(Boolean))];
        
        return new Response(JSON.stringify({
          success: true,
          result: {
            extracted_items: allItems,
            summary: {
              total_items: allItems.length,
              systems_found: systems,
              categories: categories
            }
          },
          mode,
          text_length: text.length,
          tokens_used: totalTokens,
          sections_processed: sections.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Для небольших документов используем обычную обработку
      prompt = `ФИНАЛЬНАЯ ЗАДАЧА: Извлеки АБСОЛЮТНО ВСЕ позиции из документа.

      ОБЯЗАТЕЛЬНЫЙ ФОРМАТ JSON:
      {
        "extracted_items": [
          {
            "Наименование системы": "П1", 
            "Наименование раздела": "Вентиляция", 
            "Наименование": "Вентилятор радиальный", 
            "Технические характеристики": "VTR 45B 1.1x15 EX.C KR L 0 У1", 
            "Тип, марка, обозначение": "VTR 45B", 
            "Код изделия": "1", 
            "Завод изготовитель": "NED", 
            "Ед измерения": "шт.", 
            "Количество": "1", 
            "Категория": "Оборудование", 
            "Примечание": ""
          }
        ],
        "summary": {
          "total_items": 150,
          "systems_found": ["В1", "В1а", "В2", "П1", "П2"],
          "categories": {
            "Оборудование": 25,
            "Изделия": 50,
            "Материалы": 75
          }
        }
      }

      СТРОГИЕ ПРАВИЛА:
      1. ВОЗВРАЩАЙ ТОЛЬКО JSON!
      2. ИЗВЛЕКАЙ ВСЕ 100% ПОЗИЦИЙ!
      3. ЗАПРЕЩЕНО писать "далее по аналогии", "и т.д.", "..."
      4. КАЖДАЯ ПОЗИЦИЯ ДОЛЖНА БЫТЬ УКАЗАНА ПОЛНОСТЬЮ

      ТЕКСТ ДОКУМЕНТА:
      ${text}`;
    }

    // Система с повторными попытками и восстановлением JSON
    let result = '';
    let attempts = 0;
    const maxAttempts = 3;
    let tokensUsed = null;
    
    while (attempts < maxAttempts) {
      attempts++;
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
              content: mode === 'structured_complete' 
                ? `Ты супер-точный экстрактор данных для коммерческих предложений. КРИТИЧНО: 
                   1. Извлекаешь 100% позиций без сокращений
                   2. НИКОГДА не пишешь "далее по аналогии", "и т.д.", "..."
                   3. ВОЗВРАЩАЙ ТОЛЬКО ЧИСТЫЙ JSON БЕЗ КОММЕНТАРИЕВ
                   4. ВСЕ ПОЗИЦИИ ДОЛЖНЫ БЫТЬ ПЕРЕЧИСЛЕНЫ ПОЛНОСТЬЮ
                   5. ЗАВЕРШАЙ JSON ПРАВИЛЬНО с закрывающими скобками!
                   6. НИКАКИХ ОБРЫВОВ МАССИВОВ ИЛИ ОБЪЕКТОВ!`
                : 'Ты эксперт по техническим документам и спецификациям оборудования. Отвечай на русском языке. КРИТИЧНО: ВСЕГДА возвращай ПОЛНЫЙ результат в правильном JSON формате. НИКОГДА не сокращай списки и не пиши "и т.д.". ИЗВЛЕКАЙ ВСЕ позиции без исключения!'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.01,
          max_tokens: mode === 'structured_complete' ? 30000 : 16000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ OpenAI API error:', errorData);
        
        if (attempts === maxAttempts) {
          throw new Error(`OpenAI API ошибка: ${errorData.error?.message || 'Неизвестная ошибка'}`);
        }
        
        console.log(`🔄 Retry after API error, attempt ${attempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Экспоненциальная задержка
        continue;
      }

      const data = await response.json();
      result = data.choices[0].message.content;
      tokensUsed = data.usage;

      console.log(`📄 AI ответ получен, длина: ${result.length} символов`);

      // Валидация и восстановление JSON для structured режимов
      if (mode === 'structured' || mode === 'structured_complete') {
        try {
          const parsed = JSON.parse(result);
          
          if (!parsed.extracted_items || !Array.isArray(parsed.extracted_items)) {
            throw new Error('Неверная структура ответа: отсутствует массив extracted_items');
          }
          
          console.log(`✅ Успешно извлечено позиций: ${parsed.extracted_items.length}`);
          
          // Проверка на сокращения
          const resultStr = result.toLowerCase();
          if (resultStr.includes('далее по аналогии') || 
              resultStr.includes('и т.д.') || 
              resultStr.includes('остальные позиции') ||
              resultStr.includes('...')) {
            console.warn('⚠️ ВНИМАНИЕ: Обнаружены сокращения в ответе!');
          }
          
          // Успешная валидация - выходим из цикла
          break;
          
        } catch (parseError) {
          console.error(`❌ Ошибка парсинга JSON (попытка ${attempts}):`, parseError);
          console.log('📊 Raw result length:', result.length);
          console.log('📄 Raw result end:', result.slice(-300));
          
          // Попытка восстановить JSON
          if (attempts < maxAttempts) {
            console.log('🛠️ Попытка восстановить JSON...');
            
            // Проверяем, если JSON оборван
            if (result.includes('"extracted_items"') && !result.trim().endsWith('}')) {
              console.log('🔧 JSON выглядит оборванным, пробуем восстановить...');
              
              // Базовое восстановление - закрываем массив и объект
              let fixedResult = result.trim();
              
              // Убираем возможные незавершенные элементы
              const lastItemStart = fixedResult.lastIndexOf('{');
              const lastItemEnd = fixedResult.lastIndexOf('}');
              
              if (lastItemStart > lastItemEnd) {
                // Последний объект не закрыт - удаляем его
                const beforeIncomplete = fixedResult.substring(0, lastItemStart);
                // Ищем последнюю запятую перед незакрытым объектом
                const lastComma = beforeIncomplete.lastIndexOf(',');
                if (lastComma > 0) {
                  fixedResult = beforeIncomplete.substring(0, lastComma);
                }
              }
              
              // Закрываем массив если нужно
              if (!fixedResult.includes('"]') && !fixedResult.includes('] }')) {
                if (!fixedResult.trim().endsWith('}')) {
                  fixedResult += '}';
                }
                fixedResult += ']';
              }
              
              // Закрываем основной объект если нужно
              if (!fixedResult.trim().endsWith('}')) {
                fixedResult += '}';
              }
              
              try {
                const fixedParsed = JSON.parse(fixedResult);
                console.log(`🎯 JSON восстановлен! Позиций: ${fixedParsed.extracted_items?.length || 0}`);
                result = fixedResult;
                break;
              } catch (fixError) {
                console.log('❌ Восстановление JSON не удалось:', fixError.message);
              }
            }
            
            // Если восстановление не удалось - делаем новую попытку
            console.log(`🔄 Делаем новую попытку ${attempts + 1}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            continue;
          } else {
            // Последняя попытка - возвращаем частичные данные вместо ошибки
            console.log('🔄 Максимальное количество попыток достигнуто, возвращаем частичный результат');
            
            return new Response(JSON.stringify({ 
              success: false,
              result: `Извините, не удалось получить полный структурированный результат после ${maxAttempts} попыток. Обработано ${result.length} символов. Возможная причина: слишком большой объем данных. Попробуйте разбить документ на меньшие части или используйте режим "Извлечь данные".`,
              mode,
              text_length: text.length,
              attempts_used: attempts,
              tokens_used: tokensUsed,
              chunk_info: mode === 'structured' ? { chunkIndex, totalChunks } : undefined,
              partial_data: result.substring(0, 1000) + '...'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } else {
        // Для других режимов валидация не нужна
        break;
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      result,
      mode,
      text_length: text.length,
      attempts_used: attempts,
      tokens_used: tokensUsed,
      chunk_info: mode === 'structured' ? { chunkIndex, totalChunks } : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Ошибка в AI обработке:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});