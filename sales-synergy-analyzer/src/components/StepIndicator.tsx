import React from 'react';
import type { LoadingStep } from '../types/stock';

const STEPS: Record<LoadingStep, string> = {
  1: 'Buscando cotação e indicadores...',
  2: 'Identificando concorrentes do setor...',
  3: 'Buscando earnings release na SEC...',
  4: 'Gerando scores e resumo com IA...',
  5: 'Pronto',
};

interface Props {
  currentStep: LoadingStep;
}

export function StepIndicator({ currentStep }: Props) {
  return (
    <div className="w-full max-w-md mx-auto mt-8">
      <div className="space-y-3">
        {(Object.entries(STEPS) as [string, string][]).map(([step, label]) => {
          const stepNum = Number(step) as LoadingStep;
          const isDone   = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          return (
            <div key={step} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 transition-colors"
                style={{
                  background: isDone ? '#22c55e' : isActive ? '#378ADD' : '#1e2640',
                  color: isDone || isActive ? '#fff' : '#4b5563',
                  animation: isActive ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : undefined,
                }}
              >
                {isDone ? '✓' : stepNum}
              </div>
              <span
                className="text-sm"
                style={{
                  color: isActive ? '#d0d8e8' : isDone ? '#6b7280' : '#374151',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
