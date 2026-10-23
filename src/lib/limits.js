/** Turn a DB limit-trigger error into a clean message, or null if it isn't one. */
export function limitErrorMessage(text) {
  const m = String(text || '').match(/you can create at most \d+ (trading accounts|backtesting strategies)/i);
  if (!m) return null;
  return `${m[0].charAt(0).toUpperCase()}${m[0].slice(1)}.`;
}
