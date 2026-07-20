import { useState } from 'react';
import type { SnowflakeAnalysis, SnowflakeCheck, SnowflakeGroup } from '../types/stock';

interface Props {
  data: SnowflakeAnalysis;
}

const SECTIONS = [
  { key: 'value' as const, label: 'Valuation'},
  { key: 'future' as const, label: 'Future Growth' },
  { key: 'past' as const, label: 'Past Performance' },
  { key: 'health' as const, label: 'Financial Health' },
  { key: 'dividend' as const, label: 'Dividends' },
] as const;

// Cores profissionais - tons neutros com variação sutil
const SECTION_STYLES = {
  value: { accent: '#2563eb', bg: '#0a1628' },      // Azul
  future: { accent: '#059669', bg: '#0a1a14' },     // Verde
  past: { accent: '#7c3aed', bg: '#160c2a' },       // Roxo
  health: { accent: '#d97706', bg: '#1a1008' },     // Âmbar
  dividend: { accent: '#dc2626', bg: '#1a0808' },   // Vermelho
};

// Paleta de cores principal - profissional
const COLORS = {
  bg: '#0a0e14',
  bgCard: '#111827',
  bgHover: '#1a2332',
  border: '#1e2a3a',
  borderLight: '#2a3a4a',
  text: '#e5e9f0',
  textSecondary: '#8896a8',
  textDim: '#5a6a7a',
  success: '#34d399',
  successBg: '#0a1f14',
  danger: '#f87171',
  dangerBg: '#1f0a0a',
  neutral: '#6b7280',
  neutralBg: '#111827',
  scoreHigh: '#34d399',
  scoreMid: '#fbbf24',
  scoreLow: '#f87171',
};

function CheckIcon({ passed }: { passed: boolean | null }) {
  if (passed === true) {
    return <span style={{ color: COLORS.success, fontWeight: 600, fontSize: 14 }}>✓</span>;
  }
  if (passed === false) {
    return <span style={{ color: COLORS.danger, fontWeight: 600, fontSize: 14 }}>✗</span>;
  }
  return <span style={{ color: COLORS.textDim, fontSize: 14 }}>–</span>;
}

function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  
  let color = COLORS.scoreMid;
  let label = 'Médio';
  if (pct >= 67) { color = COLORS.scoreHigh; label = 'Bom'; }
  else if (pct >= 34) { color = COLORS.scoreMid; label = 'Regular'; }
  else { color = COLORS.scoreLow; label = 'Fraco'; }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>
        {score}/{max}
      </span>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded"
        style={{ 
          background: 'rgba(255,255,255,0.05)', 
          color: color,
          border: `1px solid ${color}33`
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  
  let fill = COLORS.scoreMid;
  if (pct >= 67) fill = COLORS.scoreHigh;
  else if (pct < 34) fill = COLORS.scoreLow;

  return (
    <div className="flex-1">
      <div 
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ 
          width: `${pct}%`, 
          background: fill,
          boxShadow: `0 0 8px ${fill}44`
        }}
      />
    </div>
  );
}

function Panel({ 
  section, 
  group, 
  isOpen, 
  onToggle 
}: { 
  section: typeof SECTIONS[number];
  group: SnowflakeGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const style = SECTION_STYLES[section.key];

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200"
      style={{ 
        border: `1px solid ${isOpen ? style.accent + '44' : COLORS.border}`,
        background: COLORS.bgCard,
      }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-opacity-80"
        style={{ background: isOpen ? style.bg : 'transparent' }}
        onClick={onToggle}
      >
        
        <span className="text-sm font-medium shrink-0" style={{ color: COLORS.text, minWidth: 120 }}>
          {section.label}
        </span>
        
        <ScoreBar score={group.score} max={group.max} />
        
        <ScoreBadge score={group.score} max={group.max} />
        
        <span 
          className="text-xs transition-transform duration-200 shrink-0"
          style={{ color: COLORS.textDim, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>

      {/* Body - Checks List */}
      {isOpen && (
        <div className="px-4 pb-3 pt-1">
          {group.checks.map((check: SnowflakeCheck, index: number) => (
            <div
              key={check.key}
              className="flex items-start gap-3 py-2.5"
              style={{
                borderTop: index === 0 ? 'none' : `1px solid ${COLORS.border}`,
              }}
            >
              <div className="mt-0.5 shrink-0 w-5 text-center">
                <CheckIcon passed={check.passed} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: COLORS.text }}>
                  {check.label}
                </p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: COLORS.textSecondary }}>
                  {check.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SnowflakeSection({ data }: Props) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (key: string) => {
    setOpenSection(openSection === key ? null : key);
  };

  return (
    <div className="space-y-2">
      {SECTIONS.map((section) => {
        const group = data[section.key];
        if (!group) return null;
        
        return (
          <Panel
            key={section.key}
            section={section}
            group={group}
            isOpen={openSection === section.key}
            onToggle={() => toggleSection(section.key)}
          />
        );
      })}
    </div>
  );
}