import React, { useState } from 'react';
import { analyzeStock } from './services/api';
import type { StockAnalysis, LoadingStep } from './types/stock';
import { SearchBar } from './components/SearchBar';
import { StepIndicator } from './components/StepIndicator';
import { PriceHeader } from './components/PriceHeader';
import { SnowflakeChart } from './components/SnowflakeChart';
import { SnowflakeSection } from './components/SnowflakeSection';
import { PriceTargetChart } from './components/PriceTargetChart';
import { ChartNoAxesCombined } from "lucide-react";

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
    <div
      className="min-h-screen"
      style={{ background: '#0d1117', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Top bar */}
      <div
        className="sticky top-0 z-10"
        style={{ background: '#0d1117', borderBottom: '1px solid #1e2640' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <ChartNoAxesCombined
              size={26}
              strokeWidth={2}
              className="text-blue-400 flex-shrink-0"
            />
            <span className="font-bold text-white">Radar de Ativos</span>
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
            <div
              className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-6"
              style={{ borderColor: '#378ADD', borderTopColor: 'transparent' }}
            />
            <StepIndicator currentStep={step} />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            className="max-w-md mx-auto mt-12 p-6 rounded-xl"
            style={{ background: '#1a0f0f', border: '1px solid #4b1515' }}
          >
            <h3 className="font-semibold text-red-400 mb-1">Erro na análise</h3>
            <p className="text-sm text-red-300">{error}</p>
            <p className="text-xs text-gray-500 mt-3">Verifique se o ticker está correto (ex: AAPL, MSFT, GOOGL)</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="text-center py-24">
            <h2 className="text-2xl font-bold text-gray-100 mb-2">Radar de Ativos</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Digite um ticker NYSE ou NASDAQ para obter análise com gráfico interativo e modelo Snowflake
            </p>
          </div>
        )}

        {/* Results */}
        {data && !loading && (
          <>
            <PriceHeader data={data} />

            {/* Snowflake */}
            {data.snowflake ? (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-200 mb-6">Análise Snowflake</h2>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
                  <div className="lg:col-span-2 flex items-start justify-center">
                    <SnowflakeChart data={data.snowflake} />
                  </div>
                  <div className="lg:col-span-3">
                    <SnowflakeSection data={data.snowflake} />
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="mt-6 p-4 rounded-xl text-sm"
                style={{ background: '#1a1500', border: '1px solid #4b3900', color: '#d4a017' }}
              >
                Análise Snowflake indisponível para este ticker.
              </div>
            )}

            {/* Price Target Chart */}
            {data.analysts?.price_target && data.history && data.history.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-200 mb-3">Price Target dos Analistas</h2>
                <PriceTargetChart
                  ticker={data.ticker}
                  history={data.history}
                  priceTarget={data.analysts.price_target}
                />
              </div>
            )}

            {/* Footer */}
            <div
              className="pt-6 mt-8 flex flex-wrap justify-between items-center text-xs text-gray-500 gap-2"
              style={{ borderTop: '1px solid #1e2640' }}
            >
              <div>Fontes: {data.sources.join(' • ')}</div>
              <div>Atualizado em: {new Date(data.timestamp).toLocaleString('pt-BR')}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
