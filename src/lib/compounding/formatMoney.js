export function formatMoney(value, options) {
  const abs = Math.abs(value);
  if (options?.compact) {
    if (abs >= 1000) {
      const short = `${(abs / 1000).toFixed(1)}k`;
      return value < 0 ? `-$${short}` : `$${short}`;
    }
    const short = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return value < 0 ? `-$${short}` : `$${short}`;
  }
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}
