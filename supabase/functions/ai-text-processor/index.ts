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

    const { text, mode = 'test' } = await req.json();
    
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
      prompt = `Извлеки из технических документов структурированные данные в формате таблицы со столбцами:
      
      ЭТАЛОННЫЙ ФОРМАТ:
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
        ]
      }

      ПРАВИЛА ИЗВЛЕЧЕНИЯ:
      1. Из спецификаций оборудования извлекай каждую позицию как отдельный элемент
      2. "Наименование системы" - берется из названия системы (П1, В1, ОВ и т.д.)
      3. "Наименование раздела" - общий раздел (Вентиляция, Отопление, Холодоснабжение)
      4. "Наименование" - краткое название оборудования/материала
      5. "Технические характеристики" - полная техническая спецификация
      6. "Тип, марка, обозначение" - конкретная марка/модель
      7. "Код изделия" - номер позиции или артикул
      8. "Завод изготовитель" - производитель
      9. "Ед измерения" - единица (шт., кг, м, м2, м3)
      10. "Количество" - количество
      11. "Категория" - тип материала (Оборудование, Материалы, Изделия)
      12. "Примечание" - дополнительные данные

      Анализируй следующий текст и извлекай ВСЕ позиции из спецификаций:
      
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
            content: 'Ты эксперт по техническим документам и спецификациям оборудования. Отвечай на русском языке. ВСЕГДА возвращай результат в правильном JSON формате.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4000,
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

    return new Response(JSON.stringify({ 
      success: true,
      result,
      mode,
      text_length: text.length,
      tokens_used: data.usage
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