export const CHART_SYMBOLS = [
  { id: 'XAUUSD', tv: 'OANDA:XAUUSD', label: 'XAUUSD' },
  { id: 'EURUSD', tv: 'OANDA:EURUSD', label: 'EURUSD' },
  { id: 'GBPUSD', tv: 'OANDA:GBPUSD', label: 'GBPUSD' },
  { id: 'USDJPY', tv: 'OANDA:USDJPY', label: 'USDJPY' },
  { id: 'NAS100', tv: 'OANDA:NAS100USD', label: 'NAS100' },
  { id: 'US30', tv: 'OANDA:US30USD', label: 'US30' },
];

export const CHART_MODE_KEY = 'finhub_checklist_chart_mode';
export const CHART_SYMBOL_KEY = 'finhub_checklist_chart_symbol';

export function readChartMode() {
  try {
    const saved = localStorage.getItem(CHART_MODE_KEY);
    if (saved === 'journal' || saved === 'tradingview') return saved;
  } catch {
    /* ignore */
  }
  return 'tradingview';
}

export function readChartSymbol() {
  try {
    const saved = localStorage.getItem(CHART_SYMBOL_KEY);
    if (CHART_SYMBOLS.some((s) => s.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return 'XAUUSD';
}
