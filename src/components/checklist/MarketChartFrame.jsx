import { useEffect, useRef, useState } from 'react';
import { btnGhost, card, pillBtn, pillToggle } from '../../lib/ui';

const STORAGE_KEY = 'finhub_checklist_chart_symbol';
const TV_SCRIPT = 'https://s3.tradingview.com/tv.js';

const SYMBOLS = [
  { id: 'XAUUSD', tv: 'OANDA:XAUUSD', label: 'XAUUSD' },
  { id: 'EURUSD', tv: 'OANDA:EURUSD', label: 'EURUSD' },
  { id: 'GBPUSD', tv: 'OANDA:GBPUSD', label: 'GBPUSD' },
  { id: 'USDJPY', tv: 'OANDA:USDJPY', label: 'USDJPY' },
  { id: 'NAS100', tv: 'OANDA:NAS100USD', label: 'NAS100' },
  { id: 'US30', tv: 'OANDA:US30USD', label: 'US30' },
];

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 5.5V2.5H5.5M8.5 2.5H11.5V5.5M11.5 8.5V11.5H8.5M5.5 11.5H2.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CompressIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5.5 2.5V5.5H2.5M11.5 5.5H8.5V2.5M8.5 11.5V8.5H11.5M2.5 8.5H5.5V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function loadTradingViewScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.TradingView) return Promise.resolve();
  if (window.__tvScriptPromise) return window.__tvScriptPromise;

  window.__tvScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TV_SCRIPT}"]`);
    if (existing) {
      if (window.TradingView) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('TradingView script failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TV_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('TradingView script failed'));
    document.head.appendChild(script);
  });

  return window.__tvScriptPromise;
}

function readSavedSymbol() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SYMBOLS.some((s) => s.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return 'XAUUSD';
}

export default function MarketChartFrame({ onClose }) {
  const rootRef = useRef(null);
  const hostRef = useRef(null);
  const containerIdRef = useRef(`tv_chart_${Math.random().toString(36).slice(2, 10)}`);
  const [symbolId, setSymbolId] = useState(readSavedSymbol);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const symbol = SYMBOLS.find((s) => s.id === symbolId) || SYMBOLS[0];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, symbolId);
    } catch {
      /* ignore */
    }
  }, [symbolId]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e) {
      if (e.key === 'Escape') setIsFullscreen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen]);

  useEffect(() => {
    // Let TradingView autosize pick up the new layout bounds.
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 80);
    return () => window.clearTimeout(id);
  }, [isFullscreen]);

  useEffect(() => {
    let cancelled = false;
    const containerId = containerIdRef.current;

    async function mount() {
      setError(null);
      try {
        await loadTradingViewScript();
      } catch {
        if (!cancelled) setError('Could not load market chart.');
        return;
      }
      if (cancelled || !hostRef.current || !window.TradingView) return;

      hostRef.current.innerHTML = '';
      const mountNode = document.createElement('div');
      mountNode.id = containerId;
      mountNode.style.width = '100%';
      mountNode.style.height = '100%';
      hostRef.current.appendChild(mountNode);

      const isDark = document.documentElement.classList.contains('dark');
      // TradingView mutates the container; recreate on symbol change.
      // eslint-disable-next-line no-new
      new window.TradingView.widget({
        autosize: true,
        symbol: symbol.tv,
        interval: '15',
        timezone: 'Etc/UTC',
        theme: isDark ? 'dark' : 'light',
        style: '1',
        locale: 'en',
        toolbar_bg: isDark ? '#18181b' : '#ffffff',
        enable_publishing: false,
        allow_symbol_change: false,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: containerId,
      });
    }

    mount();

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, [symbol.tv]);

  const rootClass = isFullscreen
    ? 'fixed inset-0 z-[180] flex flex-col overflow-hidden bg-white dark:bg-zinc-950'
    : `${card} flex min-h-0 flex-1 flex-col overflow-hidden`;

  return (
    <div ref={rootRef} className={rootClass}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Market</span>
        <div className={`${pillToggle} ml-auto max-w-full flex-wrap`}>
          {SYMBOLS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={pillBtn(s.id === symbolId)}
              onClick={() => setSymbolId(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${btnGhost} shrink-0 px-2 py-1.5`}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={() => setIsFullscreen((v) => !v)}
        >
          {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
        </button>
        {onClose && !isFullscreen ? (
          <button
            type="button"
            className={`${btnGhost} shrink-0 px-2 py-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300`}
            aria-label="Hide market"
            title="Hide market"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-sm text-zinc-500">
          {error}
        </div>
      ) : (
        <div
          ref={hostRef}
          className={`w-full flex-1 ${isFullscreen ? 'min-h-0' : 'min-h-[420px] lg:min-h-0'}`}
        />
      )}
    </div>
  );
}
