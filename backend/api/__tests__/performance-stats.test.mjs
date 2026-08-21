import { describe, it, expect } from 'vitest';
import {
  calcSharpe,
  calcSortino,
  calcMaxDrawdown,
  calcKellyHalf,
  buildPerformanceSummary,
} from '../performance-stats.mjs';

describe('calcSharpe', () => {
  it('computes trade-level Sharpe on R-multiples', () => {
    expect(calcSharpe([2, -1, 2, -1])).toBe(0.29);
  });

  it('returns null with fewer than 2 trades', () => {
    expect(calcSharpe([1])).toBeNull();
    expect(calcSharpe([])).toBeNull();
  });

  it('returns null when there is no variance (cannot divide by zero)', () => {
    expect(calcSharpe([1, 1, 1])).toBeNull();
  });
});

describe('calcSortino', () => {
  it('computes trade-level Sortino using downside deviation', () => {
    expect(calcSortino([2, -1, 2, -1])).toBe(0.5);
  });

  it('returns null when there are no losing trades', () => {
    expect(calcSortino([1, 2, 3])).toBeNull();
  });

  it('returns null with fewer than 2 trades', () => {
    expect(calcSortino([1])).toBeNull();
  });
});

describe('calcMaxDrawdown', () => {
  it('finds the largest peak-to-trough decline in a rising-then-falling equity curve', () => {
    const trades = [
      { date: '2026-01-01', pnl_usd: 100 },
      { date: '2026-01-02', pnl_usd: 50 },
      { date: '2026-01-03', pnl_usd: -80 },
      { date: '2026-01-04', pnl_usd: 20 },
    ];
    // equity: 100, 150, 70, 90 -> peak 150, trough 70 -> drawdown 80 (150->70)
    expect(calcMaxDrawdown(trades)).toEqual({ usd: 80, pct: 53.3 });
  });

  it('returns zero drawdown for fewer than 2 trades', () => {
    expect(calcMaxDrawdown([])).toEqual({ usd: 0, pct: 0 });
    expect(calcMaxDrawdown([{ date: '2026-01-01', pnl_usd: 50 }])).toEqual({ usd: 0, pct: 0 });
  });
});

describe('calcKellyHalf', () => {
  it('computes half-Kelly suggested risk percentage', () => {
    expect(calcKellyHalf(60, 1.5)).toBe(16.7);
  });

  it('returns null when payoff ratio is missing or non-positive', () => {
    expect(calcKellyHalf(60, null)).toBeNull();
    expect(calcKellyHalf(60, 0)).toBeNull();
  });

  it('returns null at 0% or 100% win rate', () => {
    expect(calcKellyHalf(0, 1.5)).toBeNull();
    expect(calcKellyHalf(100, 1.5)).toBeNull();
  });
});

describe('buildPerformanceSummary quant metrics', () => {
  it('attaches sharpe, sortino, max_drawdown, kelly_half_pct', () => {
    const trades = [
      { date: '2026-01-01', result: 'win', r_value: 2, pnl_usd: 200 },
      { date: '2026-01-02', result: 'loss', r_value: -1, pnl_usd: -100 },
      { date: '2026-01-03', result: 'win', r_value: 2, pnl_usd: 200 },
      { date: '2026-01-04', result: 'loss', r_value: -1, pnl_usd: -100 },
    ];
    const summary = buildPerformanceSummary(trades, { account_id: 'a1' });
    expect(summary.sharpe).toBe(0.29);
    expect(summary.sortino).toBe(0.5);
    // equity curve (date order): 200, 100, 300, 200 -> peak 200 to trough 100 = $100 (33.3%) drawdown
    expect(summary.max_drawdown).toEqual({ usd: 100, pct: 33.3 });
    expect(summary.kelly_half_pct).not.toBeNull();
  });
});
