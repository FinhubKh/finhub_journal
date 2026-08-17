import { describe, expect, it } from 'vitest';
import { fmtR, fmtTradeR, tradeRValue } from './format.js';

describe('tradeRValue', () => {
  it('uses stored R when it is set', () => {
    expect(tradeRValue({ r_value: 1.5, pnl_usd: 100 }, 50)).toBe(1.5);
  });

  it('falls back to pnl / avgLoss when stored R is missing', () => {
    expect(tradeRValue({ r_value: 0, pnl_usd: 80 }, 40)).toBe(2);
    expect(tradeRValue({ pnl_usd: -20 }, 40)).toBe(-0.5);
  });

  it('returns null when neither stored R nor avgLoss is available', () => {
    expect(tradeRValue({ r_value: 0, pnl_usd: 80 }, 0)).toBeNull();
  });
});

describe('fmtTradeR', () => {
  it('formats fallback R the same way as stored R', () => {
    expect(fmtTradeR({ r_value: 0, pnl_usd: 80 }, 40)).toBe('+2.00R');
    expect(fmtTradeR({ r_value: 0, pnl_usd: -20 }, 40)).toBe('-0.50R');
    expect(fmtTradeR({ r_value: 0, pnl_usd: 80 }, 0)).toBe('—');
  });
});

describe('fmtR', () => {
  it('shows 0.00R for a true zero', () => {
    expect(fmtR(0)).toBe('0.00R');
  });
});
