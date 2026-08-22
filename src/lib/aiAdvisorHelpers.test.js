import { describe, expect, it } from 'vitest';
import {
  computeRiskState,
  computePeriodPacing,
  computeModelDisciplineStreak,
  computePreviousPeriod,
} from './aiAdvisorHelpers.js';

describe('computeRiskState', () => {
  it('returns calm with no losing streak and low drawdown', () => {
    const summary = { streaks: { current_streak: { type: 'win', count: 3 } }, max_drawdown: { pct: 2 }, kelly_half_pct: 5 };
    expect(computeRiskState(summary)).toBe('calm');
  });

  it('returns elevated at a 2-loss streak', () => {
    const summary = { streaks: { current_streak: { type: 'loss', count: 2 } }, max_drawdown: { pct: 2 }, kelly_half_pct: 5 };
    expect(computeRiskState(summary)).toBe('elevated');
  });

  it('returns elevated when drawdown reaches the half-Kelly threshold', () => {
    const summary = { streaks: { current_streak: { type: 'win', count: 1 } }, max_drawdown: { pct: 5 }, kelly_half_pct: 5 };
    expect(computeRiskState(summary)).toBe('elevated');
  });

  it('returns alert at a 4-loss streak', () => {
    const summary = { streaks: { current_streak: { type: 'loss', count: 4 } }, max_drawdown: { pct: 1 }, kelly_half_pct: 5 };
    expect(computeRiskState(summary)).toBe('alert');
  });

  it('returns alert when drawdown reaches double the half-Kelly threshold', () => {
    const summary = { streaks: { current_streak: { type: 'win', count: 0 } }, max_drawdown: { pct: 10 }, kelly_half_pct: 5 };
    expect(computeRiskState(summary)).toBe('alert');
  });

  it('falls back to streak-only reasoning when kelly_half_pct is null', () => {
    const summary = { streaks: { current_streak: { type: 'loss', count: 2 } }, max_drawdown: { pct: 0 }, kelly_half_pct: null };
    expect(computeRiskState(summary)).toBe('elevated');
  });

  it('defaults to calm with no data', () => {
    expect(computeRiskState({})).toBe('calm');
  });
});

describe('computePeriodPacing', () => {
  it('computes current win rate as a percentage of the previous period', () => {
    const current = { trade_count: 10, win_rate: 60 };
    const previous = { trade_count: 10, win_rate: 50 };
    expect(computePeriodPacing(current, previous)).toEqual({ hasComparison: true, pct: 120 });
  });

  it('has no comparison when the previous period has no trades', () => {
    const current = { trade_count: 5, win_rate: 60 };
    const previous = { trade_count: 0, win_rate: 0 };
    expect(computePeriodPacing(current, previous)).toEqual({ hasComparison: false, pct: null });
  });

  it('has no comparison when the previous period win rate is zero', () => {
    const current = { trade_count: 5, win_rate: 20 };
    const previous = { trade_count: 5, win_rate: 0 };
    expect(computePeriodPacing(current, previous)).toEqual({ hasComparison: false, pct: null });
  });

  it('has no comparison when previous summary is null', () => {
    expect(computePeriodPacing({ trade_count: 5, win_rate: 20 }, null)).toEqual({ hasComparison: false, pct: null });
  });
});

describe('computeModelDisciplineStreak', () => {
  it('counts a full consecutive streak from the most recent trade', () => {
    const trades = [{ model: 'A' }, { model: 'B' }, { model: 'A' }, { model: 'A' }, { model: 'A' }];
    expect(computeModelDisciplineStreak(trades)).toEqual({ count: 5, total: 5 });
  });

  it('stops counting at the first trade without a model', () => {
    const trades = [{ model: 'A' }, { model: 'A' }, { model: null }, { model: 'A' }];
    expect(computeModelDisciplineStreak(trades)).toEqual({ count: 2, total: 4 });
  });

  it('reports total below the window size when fewer trades exist', () => {
    const trades = [{ model: 'A' }, { model: 'A' }];
    expect(computeModelDisciplineStreak(trades)).toEqual({ count: 2, total: 2 });
  });

  it('returns zero count with no trades', () => {
    expect(computeModelDisciplineStreak([])).toEqual({ count: 0, total: 0 });
  });
});

describe('computePreviousPeriod', () => {
  it('returns an immediately preceding range of the same length', () => {
    expect(computePreviousPeriod('2026-08-01', '2026-08-30')).toEqual({ from: '2026-07-02', to: '2026-07-31' });
  });

  it('handles a single-day range', () => {
    expect(computePreviousPeriod('2026-08-15', '2026-08-15')).toEqual({ from: '2026-08-14', to: '2026-08-14' });
  });
});
