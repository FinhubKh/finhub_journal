import { describe, expect, it } from 'vitest';
import {
  buildSeries,
  pointsFromProps,
  startingEquityFromStats,
} from './equityChart';

describe('pointsFromProps', () => {
  it('prefers daily buckets when present', () => {
    const daily = [{ date: '2026-08-21', pnl: 10, r_value: 1 }];
    const trades = [{ date: '2026-08-21', pnl_usd: 99 }];
    expect(pointsFromProps(daily, trades)).toEqual([
      { date: '2026-08-21', pnl: 10, r_value: 1 },
    ]);
  });

  it('aggregates trades by calendar day when daily is empty', () => {
    const trades = [
      { date: '2026-08-21', pnl_usd: 1.0, r_value: 0.5 },
      { date: '2026-08-21', pnl_usd: 0.81, r_value: 0.2 },
      { date: '2026-08-20', pnl_usd: -2, r_value: -1 },
    ];
    expect(pointsFromProps([], trades)).toEqual([
      { date: '2026-08-20', pnl: -2, r_value: -1 },
      { date: '2026-08-21', pnl: 1.81, r_value: 0.7 },
    ]);
  });
});

describe('buildSeries', () => {
  it('prepends a Start anchor so a single day still has two points', () => {
    const { labels, dataUsd, peakUsd } = buildSeries(
      [{ date: '2026-08-21', pnl: 1.81 }],
      'usd',
      2000,
    );
    expect(labels).toHaveLength(2);
    expect(labels[0]).toBe('Start');
    expect(dataUsd).toEqual([2000, 2001.81]);
    expect(peakUsd).toEqual([2000, 2001.81]);
  });

  it('returns empty series when there are no points', () => {
    expect(buildSeries([], 'usd', 2000)).toEqual({
      labels: [],
      dataUsd: [],
      peakUsd: [],
    });
  });

  it('marks peak for drawdown coloring after a pullback', () => {
    const { dataUsd, peakUsd } = buildSeries(
      [
        { date: '2026-08-20', pnl: 100 },
        { date: '2026-08-21', pnl: -40 },
      ],
      'usd',
      1000,
    );
    expect(dataUsd).toEqual([1000, 1100, 1060]);
    expect(peakUsd).toEqual([1000, 1100, 1100]);
  });
});

describe('startingEquityFromStats', () => {
  it('derives start from balance minus net PnL', () => {
    expect(startingEquityFromStats({ balance: 2001.81, totalPnl: 1.81 })).toBe(2000);
  });

  it('falls back to deposits when balance is missing', () => {
    expect(startingEquityFromStats({ deposits: 500, totalPnl: 10 })).toBe(500);
  });

  it('returns 0 without stats', () => {
    expect(startingEquityFromStats(null)).toBe(0);
  });
});
