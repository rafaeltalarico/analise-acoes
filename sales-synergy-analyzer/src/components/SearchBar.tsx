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
        placeholder="Ticker americano (ex: AAPL, MSFT)"
        disabled={loading}
        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 uppercase"
        maxLength={10}
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ backgroundColor: '#378ADD' }}
      >
        {loading ? '...' : 'Analisar'}
      </button>
    </form>
  );
}
