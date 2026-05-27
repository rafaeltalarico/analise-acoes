import React, { useState } from 'react';
import type { Metrics, MetricsSummary, MetricItem } from '../types/stock';

interface Props {
  metricsSummary?: MetricsSummary | null;
}

const BLOCK_LABELS: Record<string, string> = {
  qualidade_negocio: 'Qualidade do Negócio',
  saude_financeira: 'Saúde Financeira',
  crescimento: 'Crescimento',
  preco_valor: 'Preço vs Valor',  
};

const STATUS_CONFIG = {
  positivo: {
    bg: '#EAF3DE',
    text: '#3B6D11',
  },
  neutro: {
    bg: '#FAEEDA',
    text: '#854F0B',
  },
  negativo: {
    bg: '#FCEBEB',
    text: '#A32D2D',
  },
};

function MetricRow({ item }: { item: MetricItem }) {
  const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.neutro;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">{item.label}</span>
          <span
            className="text-sm font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: config.bg, color: config.text }}
          >
            {item.value}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.frase}</p>
      </div>
    </div>
  );
}

function MetricBlock({
  blockKey,
  items,
}: {
  blockKey: string;
  items: MetricItem[];
}) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  const label = BLOCK_LABELS[blockKey] || blockKey;

  const positivos = items.filter(i => i.status === 'positivo').length;
  const negativos = items.filter(i => i.status === 'negativo').length;
  const total = items.length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-700 text-sm">{label}</span>
          <div className="flex gap-1">
            {items.map((item, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"  
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" >
            
          </span>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4">
          {items.map((item, i) => (
            <MetricRow key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MetricsBlock({ metricsSummary }: Props) {
  if (!metricsSummary) {
    return (
      <div className="text-sm text-gray-400 text-center py-6">
        Resumo de indicadores indisponível.
      </div>
    );
  }

  const BLOCK_ORDER = ['qualidade_negocio', 'saude_financeira', 'crescimento', 'preco_valor'] as const;

  const blocks = BLOCK_ORDER
    .map(key => ({ key, items: metricsSummary[key] }))
    .filter(({ items }) => Array.isArray(items) && (items?.length ?? 0) > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {blocks.map(({ key, items }) => (
        <MetricBlock key={key} blockKey={key} items={items as MetricItem[]} />
      ))}
    </div>
  );
}