import React, { useState } from 'react';

interface Props {
  onSearch: (ticker: string) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = value.trim().toUpperCase();
    if (t) onSearch(t);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md mx-auto">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        placeholder="Digite um ticker (ex: AAPL, MSFT)"
        disabled={loading}
        maxLength={10}
        className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none uppercase"
        style={{
          background: '#0a0e1a',
          border: '1px solid #1e2640',
          transition: 'border-color 0.15s',
        }}
        onFocus={e  => (e.currentTarget.style.borderColor = '#378ADD')}
        onBlur={e   => (e.currentTarget.style.borderColor = '#1e2640')}
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="px-5 py-2.5 text-white rounded-lg font-medium text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#2b5279' }}
      >
        {loading ? '...' : 'Analisar'}
      </button>
    </form>
  );
}
