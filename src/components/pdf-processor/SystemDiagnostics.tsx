import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, Wrench, Zap } from 'lucide-react';

export const SystemDiagnostics: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const diagnosticResults: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      // Test 1: Supabase Client Connection
      diagnosticResults.tests.push({
        name: 'Supabase Client Connection',
        status: 'running'
      });

      try {
        // Простая проверка подключения к Supabase
        const startTime = Date.now();
        const response = await fetch(`https://tnzkzwtkeefessnnwsiv.supabase.co/rest/v1/`, {
          method: 'HEAD',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuemt6d3RrZWVmZXNzbm53c2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjYxNjgsImV4cCI6MjA2ODM0MjE2OH0.qXCpW20mxqUSko63hISPMhd91hmJIifVtzw54mDPee8'
          }
        });
        const responseTime = Date.now() - startTime;
        
        
        if (response.ok) {
          diagnosticResults.tests[0].status = 'success';
          diagnosticResults.tests[0].message = `Supabase API доступно (${responseTime}ms)`;
        } else {
          diagnosticResults.tests[0].status = 'error';
          diagnosticResults.tests[0].message = `Supabase API недоступно: ${response.status}`;
        }
      } catch (error) {
        diagnosticResults.tests[0].status = 'error';
        diagnosticResults.tests[0].message = `Ошибка подключения: ${error.message}`;
      }

      // Test 1.5: Health Check Function
      diagnosticResults.tests.push({
        name: 'Edge Function: health-check',
        status: 'running'
      });

      try {
        const { data, error } = await supabase.functions.invoke('health-check');

        if (error) {
          diagnosticResults.tests[1].status = 'error';
          diagnosticResults.tests[1].message = `Health check ошибка: ${error.message}`;
        } else if (data && data.success) {
          diagnosticResults.tests[1].status = 'success';
          diagnosticResults.tests[1].message = `Edge Functions работают корректно. OpenAI: ${data.environment?.openai_configured ? '✅' : '❌'}`;
        } else {
          diagnosticResults.tests[1].status = 'warning';
          diagnosticResults.tests[1].message = 'Health check вернул неожиданный результат';
        }
      } catch (error) {
        diagnosticResults.tests[1].status = 'error';
        diagnosticResults.tests[1].message = `Health check критическая ошибка: ${error.message}`;
      }

      // Test 2: Edge Function - Structure Analyzer
      diagnosticResults.tests.push({
        name: 'Edge Function: structure-analyzer',
        status: 'running'
      });

      try {
        const { data, error } = await supabase.functions.invoke('structure-analyzer', {
          body: { 
            text: 'Test text for structure analysis',
            total_pages: 1
          }
        });

        if (error) {
          diagnosticResults.tests[2].status = 'error';
          diagnosticResults.tests[2].message = `Ошибка: ${error.message}`;
          diagnosticResults.tests[2].error = error;
        } else if (data) {
          diagnosticResults.tests[2].status = 'success';
          diagnosticResults.tests[2].message = 'Функция отвечает корректно';
          diagnosticResults.tests[2].response = data;
        } else {
          diagnosticResults.tests[2].status = 'warning';
          diagnosticResults.tests[2].message = 'Функция вернула пустой ответ';
        }
      } catch (error) {
        diagnosticResults.tests[2].status = 'error';
        diagnosticResults.tests[2].message = `Network/Runtime error: ${error.message}`;
        diagnosticResults.tests[2].error = error;
      }

      // Test 3: Edge Function - Data Extractor  
      diagnosticResults.tests.push({
        name: 'Edge Function: data-extractor',
        status: 'running'
      });

      try {
        const { data, error } = await supabase.functions.invoke('data-extractor', {
          body: { 
            text: 'Test equipment: Pump 1, Quantity: 2 pcs',
            section_info: {
              title: 'Test Section',
              type: 'спецификация',
              pageNumbers: [1]
            }
          }
        });

        if (error) {
          diagnosticResults.tests[3].status = 'error';
          diagnosticResults.tests[3].message = `Ошибка: ${error.message}`;
        } else {
          diagnosticResults.tests[3].status = 'success';
          diagnosticResults.tests[3].message = 'Функция отвечает корректно';
        }
      } catch (error) {
        diagnosticResults.tests[3].status = 'error';
        diagnosticResults.tests[3].message = `Network/Runtime error: ${error.message}`;
      }

      // Test 4: OpenAI API Key Check
      diagnosticResults.tests.push({
        name: 'OpenAI API Key Configuration',
        status: 'running'
      });

      try {
        // Попробуем простой тест через structure-analyzer
        const { data, error } = await supabase.functions.invoke('structure-analyzer', {
          body: { 
            text: 'Test: Page 1 content',
            total_pages: 1
          }
        });

        if (error && error.message && error.message.includes('OPENAI_API_KEY')) {
          diagnosticResults.tests[4].status = 'error';
          diagnosticResults.tests[4].message = 'OpenAI API ключ не настроен в Supabase Secrets';
        } else if (error && error.message && error.message.includes('OpenAI')) {
          diagnosticResults.tests[4].status = 'warning';
          diagnosticResults.tests[4].message = 'Проблемы с OpenAI API';
        } else {
          diagnosticResults.tests[4].status = 'success';
          diagnosticResults.tests[4].message = 'OpenAI API ключ настроен';
        }
      } catch (error) {
        diagnosticResults.tests[4].status = 'warning';
        diagnosticResults.tests[4].message = 'Не удалось проверить OpenAI API ключ';
      }

      // Test 5: Network Connectivity
      diagnosticResults.tests.push({
        name: 'Network Connectivity Test',
        status: 'running'
      });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://httpbin.org/status/200', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          diagnosticResults.tests[5].status = 'success';
          diagnosticResults.tests[5].message = 'Сетевое подключение работает';
        } else {
          diagnosticResults.tests[5].status = 'warning';
          diagnosticResults.tests[5].message = 'Проблемы с сетевым подключением';
        }
      } catch (error) {
        diagnosticResults.tests[5].status = 'error';
        diagnosticResults.tests[5].message = `Сетевая ошибка: ${error.message}`;
      }

    } catch (globalError) {
      diagnosticResults.globalError = globalError.message;
    }

    setResults(diagnosticResults);
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'running': return <Zap className="h-5 w-5 text-blue-500 animate-pulse" />;
      default: return <Wrench className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'border-green-200 bg-green-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'running': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Системная диагностика
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Проверка всех компонентов системы для диагностики ошибки "Failed to send a request to the Edge Function"
        </div>

        <Button 
          onClick={runDiagnostics}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'Выполнение диагностики...' : 'Запустить диагностику'}
        </Button>

        {results && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Диагностика выполнена: {new Date(results.timestamp).toLocaleString()}
            </div>

            {results.globalError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Критическая ошибка: {results.globalError}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              {results.tests.map((test: any, index: number) => (
                <div 
                  key={index} 
                  className={`p-3 border rounded-lg ${getStatusColor(test.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(test.status)}
                      <span className="font-medium">{test.name}</span>
                    </div>
                    <Badge variant={test.status === 'success' ? 'default' : 'destructive'}>
                      {test.status}
                    </Badge>
                  </div>
                  {test.message && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {test.message}
                    </div>
                  )}
                  {test.error && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-600 cursor-pointer">
                        Детали ошибки
                      </summary>
                      <pre className="mt-1 text-xs bg-red-100 p-2 rounded overflow-auto">
                        {JSON.stringify(test.error, null, 2)}
                      </pre>
                    </details>
                  )}
                  {test.response && (
                    <details className="mt-2">
                      <summary className="text-xs text-green-600 cursor-pointer">
                        Ответ функции
                      </summary>
                      <pre className="mt-1 text-xs bg-green-100 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(test.response, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>

            {/* Рекомендации по исправлению */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium mb-2">🔧 Рекомендации по исправлению:</h4>
              <ul className="text-sm space-y-1 text-blue-700">
                <li>• Убедитесь, что Edge Functions развернуты в Supabase</li>
                <li>• Проверьте, что OPENAI_API_KEY настроен в Secrets</li>
                <li>• Проверьте CORS настройки в Edge Functions</li>
                <li>• Убедитесь, что проект ID корректен: tnzkzwtkeefessnnwsiv</li>
                <li>• Попробуйте пере-деплоить Edge Functions</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};