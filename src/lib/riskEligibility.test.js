// src/lib/riskEligibility.test.js
import { describe, expect, it } from 'vitest';
import {
  equityBase,
  historyDays,
  evaluateRiskEligibility,
  tradeOutcomeStats,
  compareMetric,
} from './riskEligibility.js';

const day = (offset, pnl, result = pnl >= 0 ? 'win' : 'loss') => ({
  date: `2025-01-${String(1 + offset).padStart(2, '0')}`,
  pnl_usd: pnl,
  result,
  r_value: 0,
});

describe('equityBase', () => {
  it('prefers starting_balance', () => {
    expect(equityBase({ starting_balance: 10000 }, 500)).toBe(10000);
  });
  it('falls back to peak equity', () => {
    expect(equityBase({ starting_balance: 0 }, 2500)).toBe(2500);
  });
});

describe('historyDays', () => {
  it('counts inclusive span between first and last trade', () => {
    const trades = [
      day(0, 10),
      { date: '2025-07-02', pnl_usd: -5, result: 'loss', r_value: 0 },
    ];
    expect(historyDays(trades)).toBeGreaterThanOrEqual(182);
  });
});

describe('evaluateRiskEligibility', () => {
  it('returns unconfigured when risk_track is null', () => {
    const out = evaluateRiskEligibility({
      account: { risk_track: null, starting_balance: 10000 },
      trades: [day(0, 10)],
      daily: [{ date: '2025-01-01', pnl: 10 }],
      maxDd: 100,
    });
    expect(out.status).toBe('unconfigured');
    expect(out.eligible).toBe(false);
  });

  it('fails short history', () => {
    const trades = [day(0, 10), day(30, -20)];
    const out = evaluateRiskEligibility({
      account: { risk_track: 'master', starting_balance: 10000 },
      trades,
      daily: [
        { date: '2025-01-01', pnl: 10 },
        { date: '2025-01-31', pnl: -20 },
      ],
      maxDd: 20,
    });
    expect(out.eligible).toBe(false);
    expect(out.failedRules).toContain('history_6m');
  });

  it('fails daily loss above 1%', () => {
    const longTrades = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      return {
        date: iso,
        pnl_usd: i === 50 ? -200 : 5,
        result: i === 50 ? 'loss' : 'win',
        r_value: 0,
      };
    });
    const daily = longTrades.map((t) => ({ date: t.date, pnl: t.pnl_usd }));
    const out = evaluateRiskEligibility({
      account: { risk_track: 'ea', starting_balance: 10000 },
      trades: longTrades,
      daily,
      maxDd: 50,
    });
    expect(out.failedRules).toContain('daily_loss_1pct');
  });

  it('fails master on 3-loss streak', () => {
    const longTrades = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      const streak = i >= 100 && i <= 102;
      return {
        date: iso,
        pnl_usd: streak ? -10 : 5,
        result: streak ? 'loss' : 'win',
        r_value: 0,
      };
    });
    const daily = longTrades.map((t) => ({ date: t.date, pnl: t.pnl_usd }));
    const out = evaluateRiskEligibility({
      account: { risk_track: 'master', starting_balance: 10000 },
      trades: longTrades,
      daily,
      maxDd: 30,
    });
    expect(out.failedRules).toContain('losing_streak_3');
  });

  it('scores custom win-rate and trade-count rules with operators', () => {
    const longTrades = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      const win = i % 3 !== 0;
      return {
        date: iso,
        pnl_usd: win ? 10 : -5,
        result: win ? 'win' : 'loss',
        r_value: 0,
      };
    });
    const daily = longTrades.map((t) => ({ date: t.date, pnl: t.pnl_usd }));
    const out = evaluateRiskEligibility({
      account: { risk_track: 'ea', starting_balance: 10000 },
      trades: longTrades,
      daily,
      maxDd: 30,
      config: {
        custom_rules: [
          {
            id: 'c_wr',
            label: 'Win rate 60%',
            enabled: true,
            tracks: 'both',
            metric: 'win_rate',
            operator: 'gte',
            limit: 0.6,
          },
          {
            id: 'c_tc',
            label: 'At least 100 trades',
            enabled: true,
            tracks: 'both',
            metric: 'trade_count',
            operator: 'gte',
            limit: 100,
          },
        ],
      },
    });
    expect(out.failedRules).not.toContain('c_tc');
    expect(out.failedRules).not.toContain('c_wr');
    expect(out.metrics.trade_count).toBe(200);
  });

  it('scores custom formula rules', () => {
    const longTrades = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      const win = i % 2 === 0;
      return {
        date: iso,
        pnl_usd: win ? 10 : -5,
        result: win ? 'win' : 'loss',
        r_value: 0,
      };
    });
    const daily = longTrades.map((t) => ({ date: t.date, pnl: t.pnl_usd }));
    const out = evaluateRiskEligibility({
      account: { risk_track: 'ea', starting_balance: 10000 },
      trades: longTrades,
      daily,
      maxDd: 30,
      config: {
        custom_rules: [
          {
            id: 'c_f',
            label: 'Win rate pct',
            enabled: true,
            tracks: 'both',
            metric: 'formula',
            formula: 'win_rate * 100',
            operator: 'gte',
            limit: 45,
          },
        ],
      },
    });
    expect(out.failedRules).not.toContain('c_f');
    const rule = out.rules.find((r) => r.id === 'c_f');
    expect(rule?.pass).toBe(true);
    expect(rule?.actual).toBeCloseTo(50, 5);
  });
});

describe('tradeOutcomeStats / compareMetric', () => {
  it('computes win rate and profit factor', () => {
    const stats = tradeOutcomeStats([
      { result: 'win', pnl_usd: 20 },
      { result: 'win', pnl_usd: 10 },
      { result: 'loss', pnl_usd: -10 },
    ]);
    expect(stats.winRate).toBeCloseTo(2 / 3, 5);
    expect(stats.profitFactor).toBeCloseTo(3, 5);
  });

  it('compares with gte and lte', () => {
    expect(compareMetric(0.55, 0.5, 'gte')).toBe(true);
    expect(compareMetric(0.4, 0.5, 'gte')).toBe(false);
    expect(compareMetric(0.01, 0.02, 'lte')).toBe(true);
  });
});
