import React, { useEffect, useRef } from 'react';

interface Props {
  ticker: string;
}

export function PriceChart({ ticker }: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      const tv = (window as Window & { TradingView?: { widget: new (config: object) => void } }).TradingView;
      if (!tv || !container.current) return;
      new tv.widget({
        container_id: 'tv_chart_container',
        symbol: ticker,
        interval: 'D',
        timezone: 'America/New_York',
        theme: 'light',
        style: '1',
        locale: 'pt',
        toolbar_bg: '#ffffff',
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        height: 320,
        width: '100%',
      });
    };
    container.current.appendChild(script);
  }, [ticker]);


  return <div id="tv_chart_container" ref={container} className="mt-4 rounded-lg overflow-hidden" />;
}
