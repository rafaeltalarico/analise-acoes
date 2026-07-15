import React, { useState } from 'react';
import { analyzeStock } from './services/api';
import type { StockAnalysis, LoadingStep } from './types/stock';
import { SearchBar } from './components/SearchBar';
import { StepIndicator } from './components/StepIndicator';
import { PriceHeader } from './components/PriceHeader';
import { SnowflakeChart } from './components/SnowflakeChart';
import { SnowflakeSection } from './components/SnowflakeSection';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoadingStep>(1);
  const [data, setData] = useState<StockAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (ticker: string) => {
    setLoading(true);
    setData(null);
    setError(null);
    setStep(1);

    const stepTimer = setInterval(() => {
      setStep(prev => {
        if (prev < 4) return (prev + 1) as LoadingStep;
        return prev;
      });
    }, 3000);

    try {
      const result = await analyzeStock(ticker);
      setData(result);
      setStep(5);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : 'Erro ao buscar dados. Verifique o ticker e tente novamente.';
      setError(message || 'Erro desconhecido.');
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: '#378ADD' }}
            >
              $
            </div>
            <span className="font-bold text-gray-800">StockAnalyzer</span>
          </div>
          <div className="flex-1 w-full sm:max-w-md">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-6" />
            <StepIndicator currentStep={step} />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="max-w-md mx-auto mt-12 p-6 border border-red-200 rounded-xl bg-red-50">
            <h3 className="font-semibold text-red-700 mb-1">Erro na análise</h3>
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-gray-400 mt-3">Verifique se o ticker está correto (ex: AAPL, MSFT, GOOGL)</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📈</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Análise de Ações</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Digite um ticker americano para obter análise com gráfico interativo e modelo Snowflake.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['AAPL', 'MSFT', 'GOOGL', 'SCHW', 'JPM'].map(t => (
                <button
                  key={t}
                  onClick={() => handleSearch(t)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {data && !loading && (
          <>
            {/* Gráfico + cabeçalho de preço */}
            <PriceHeader data={data} />

            {/* Snowflake */}
            {data.snowflake ? (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-700 mb-6">Análise Snowflake</h2>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                  <div className="lg:col-span-2 flex items-center justify-center py-2">
                    <SnowflakeChart data={data.snowflake} />
                  </div>
                  <div className="lg:col-span-3">
                    <SnowflakeSection data={data.snowflake} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 p-4 border border-yellow-200 rounded-xl bg-yellow-50 text-sm text-yellow-700">
                Análise Snowflake indisponível para este ticker.
              </div>
            )}

            {/* Rodapé */}
            <div className="border-t border-gray-100 pt-6 mt-8 flex flex-wrap justify-between items-center text-xs text-gray-400 gap-2">
              <div>Fontes: {data.sources.join(' • ')}</div>
              <div>Atualizado em: {new Date(data.timestamp).toLocaleString('pt-BR')}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
