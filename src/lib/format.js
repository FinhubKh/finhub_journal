export function normalizePnlDenomination(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'cent' || v === 'cents' || v === 'usc') return 'cent';
  return 'usd';
}

function normalizeDenom(denomination) {
  return normalizePnlDenomination(denomination);
}

/** Currency symbol for the account denomination ($ or ¢). */
export function moneySymbol(denomination = 'usd') {
  return normalizeDenom(denomination) === 'cent' ? '¢' : '$';
}

/**
 * Display value for a single account view.
 * Stored values are already in account units (dollars or cents) — no magnitude heuristics.
 */
export function toDisplayPnl(storedValue, denomination = 'usd') {
  const n = Number(storedValue);
  if (!Number.isFinite(n)) return 0;
  void denomination;
  return n;
}

/** Convert stored account-unit PnL to USD for portfolio aggregates. */
export function toUsdPnl(storedValue, denomination = 'usd') {
  const n = Number(storedValue);
  if (!Number.isFinite(n)) return 0;
  return normalizeDenom(denomination) === 'cent' ? n / 100 : n;
}

/** Convert a user-entered display amount back to stored value (1:1 with account units). */
export function fromDisplayPnl(displayValue, _denomination = 'usd') {
  const n = Number(displayValue);
  if (!Number.isFinite(n)) return 0;
  return n;
}

/**
 * Format stored PnL for the UI.
 * Values are 1:1 with the broker; denomination only switches $ vs ¢.
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
  const n = Number(r);
  if (!Number.isFinite(n) || n === 0) return n === 0 ? '0.00R' : '';
  return n > 0 ? `+${n.toFixed(2)}R` : `${n.toFixed(2)}R`;
}

/** Stored R if set; otherwise PnL / average loss (same fallback as overview stats). */
export function tradeRValue(t, avgLoss = 0) {
  const stored = Number(t?.r_value);
  if (Number.isFinite(stored) && Math.abs(stored) > 0.01) return stored;
  const pnl = Number(t?.pnl_usd);
  const loss = Number(avgLoss);
  if (Number.isFinite(pnl) && loss > 0) return pnl / loss;
  return null;
}

export function fmtTradeR(t, avgLoss = 0) {
  const r = tradeRValue(t, avgLoss);
  if (r == null || !Number.isFinite(r)) return '—';
  return fmtR(r) || '—';
}

/** Unsigned account balance (no leading +). */
export function fmtBalance(v, denomination = 'usd') {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const displayed = toDisplayPnl(n, denomination);
  const sym = moneySymbol(denomination);
  if (displayed === 0) return `${sym}0.00`;
  return displayed > 0
    ? `${sym}${displayed.toFixed(2)}`
    : `-${sym}${Math.abs(displayed).toFixed(2)}`;
}

/** Lot size for trade tables (2 decimals, em dash when missing). */
export function fmtLot(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

export function fmtDateShort(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateLong(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
}

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Other';
}

/** Escape a CSV field (quotes, commas, newlines, formula injection). */
export function escapeCsvField(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
