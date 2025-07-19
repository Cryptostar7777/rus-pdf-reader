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
      prompt = `ФИНАЛЬНАЯ ЗАДАЧА: Извлеки АБСОЛЮТНО ВСЕ позиции из документа БЕЗ РАЗДЕЛЕНИЯ НА ЧАСТИ.

      ОСОБАЯ НАСТРОЙКА: Работай как супер-точный экстрактор данных. НЕ СОКРАЩАЙ НИЧЕГО!

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
      1. ВОЗВРАЩАЙ ТОЛЬКО JSON! НИ СЛОВА КОММЕНТАРИЕВ!
      2. ИЗВЛЕКАЙ ВСЕ 100% ПОЗИЦИЙ - никаких сокращений!
      3. ЗАПРЕЩЕНО писать "далее по аналогии", "и т.д.", "...", "(остальные позиции)"
      4. КАЖДАЯ ПОЗИЦИЯ ДОЛЖНА БЫТЬ УКАЗАНА ПОЛНОСТЬЮ
      5. Заполняй summary с точными цифрами
      6. МОИ ДЕНЬГИ ЗАВИСЯТ ОТ ПОЛНОТЫ ИЗВЛЕЧЕНИЯ!

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

      ТЕКСТ ДОКУМЕНТА ДЛЯ АНАЛИЗА:
      ${text}`;
    }

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
              ? 'Ты супер-точный экстрактор данных для коммерческих предложений. КРИТИЧНО: Извлекаешь 100% позиций без сокращений. НИКОГДА не пишешь "далее по аналогии", "и т.д.", "...". ВОЗВРАЩАЙ ТОЛЬКО ЧИСТЫЙ JSON БЕЗ КОММЕНТАРИЕВ. ВСЕ ПОЗИЦИИ ДОЛЖНЫ БЫТЬ ПЕРЕЧИСЛЕНЫ ПОЛНОСТЬЮ!'
              : 'Ты эксперт по техническим документам и спецификациям оборудования. Отвечай на русском языке. КРИТИЧНО: ВСЕГДА возвращай ПОЛНЫЙ результат в правильном JSON формате. НИКОГДА не сокращай списки и не пиши "и т.д.". ИЗВЛЕКАЙ ВСЕ позиции без исключения!'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.01, // Максимальная точность
        max_tokens: mode === 'structured_complete' ? 30000 : 16000
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API ошибка: ${errorData.error?.message || 'Неизвестная ошибка'}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    console.log(`AI ответ получен, длина: ${result.length} символов`);

    // Валидация для structured режимов
    if (mode === 'structured' || mode === 'structured_complete') {
      try {
        const parsed = JSON.parse(result);
        if (!parsed.extracted_items || !Array.isArray(parsed.extracted_items)) {
          throw new Error('Неверная структура ответа: отсутствует массив extracted_items');
        }
        console.log(`Извлечено позиций: ${parsed.extracted_items.length}`);
        
        // Проверка на сокращения
        const resultStr = result.toLowerCase();
        if (resultStr.includes('далее по аналогии') || 
            resultStr.includes('и т.д.') || 
            resultStr.includes('остальные позиции') ||
            resultStr.includes('...')) {
          console.warn('ВНИМАНИЕ: Обнаружены сокращения в ответе!');
        }
      } catch (parseError) {
        console.error('Ошибка парсинга JSON:', parseError);
        throw new Error(`Ответ не является валидным JSON: ${parseError.message}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      result,
      mode,
      text_length: text.length,
      tokens_used: data.usage,
      chunk_info: mode === 'structured' ? { chunkIndex, totalChunks } : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Ошибка в AI обработке:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});