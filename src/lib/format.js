function normalizeDenom(denomination) {
  return denomination === 'cent' ? 'cent' : 'usd';
}

/** Currency symbol for the account denomination ($ or ¢). */
export function moneySymbol(denomination = 'usd') {
  return normalizeDenom(denomination) === 'cent' ? '¢' : '$';
}

/** Display value is 1:1 with stored value (no × 100 scaling). */
export function toDisplayPnl(usdValue) {
  const n = Number(usdValue);
  if (!Number.isFinite(n)) return 0;
  return n;
}

/** Convert a user-entered display amount back to stored value (1:1). */
export function fromDisplayPnl(displayValue) {
  const n = Number(displayValue);
  if (!Number.isFinite(n)) return 0;
  return n;
}

/**
 * Format stored USD PnL for the UI.
 * Cent accounts show MT5-style amounts with ¢ (stored value × 100).
 */
export function fmtPnl(v, denomination = 'usd', { empty = '' } = {}) {
  if (v == null || v === '') return empty;
  const n = Number(v);
  if (!Number.isFinite(n)) return empty;
  if (!n) return empty;
  const displayed = toDisplayPnl(n, denomination);
  const sym = moneySymbol(denomination);
  return displayed > 0
    ? `+${sym}${displayed.toFixed(2)}`
    : `-${sym}${Math.abs(displayed).toFixed(2)}`;
}

/** Like fmtPnl but always returns a string (uses — for empty / invalid). */
export function fmtPnlStrict(v, denomination = 'usd') {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const displayed = toDisplayPnl(n, denomination);
  const sym = moneySymbol(denomination);
  if (displayed === 0) return `${sym}0.00`;
  return displayed > 0
    ? `+${sym}${displayed.toFixed(2)}`
    : `-${sym}${Math.abs(displayed).toFixed(2)}`;
}

export function fmtR(r) {
  if (!r) return '';
  return r > 0 ? `+${r.toFixed(2)}R` : `${r.toFixed(2)}R`;
}

export function fmtDateShort(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateLong(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Other';
}
