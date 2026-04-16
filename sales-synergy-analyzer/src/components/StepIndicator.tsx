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
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          return (
            <div key={step} className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 transition-colors ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isDone ? '✓' : stepNum}
              </div>
              <span
                className={`text-sm ${
                  isActive ? 'text-gray-900 font-medium' : isDone ? 'text-gray-500' : 'text-gray-300'
                }`}
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
