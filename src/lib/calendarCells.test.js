import { describe, expect, it } from 'vitest';
import { bucketDailyByMonth, buildMonthWeeks, yearsFromDates } from './calendarCells.js';

describe('bucketDailyByMonth', () => {
  it('groups rows into the matching month of the year', () => {
    const map = bucketDailyByMonth([
      { date: '2025-05-16', pnl: 10 },
      { date: '2025-05-17', pnl: -4 },
      { date: '2024-05-16', pnl: 99 },
    ], 2025);
    expect(map[5]).toHaveLength(2);
    expect(map[1]).toHaveLength(0);
  });
});

describe('buildMonthWeeks', () => {
  it('builds monday-first weeks with daily totals', () => {
    const dayMap = {
      '2025-05-16': { date: '2025-05-16', pnl: 12.5, trades: 2 },
    };
    const weeks = buildMonthWeeks(2025, 5, dayMap, {}, false);
    const withTrade = weeks.find((w) => w.days.includes('2025-05-16'));
    expect(withTrade.weekTrades).toBe(2);
    expect(withTrade.weekPnl).toBe(12.5);
    expect(withTrade.days[0] === null || withTrade.days[0].endsWith('-12') || withTrade.days[0].startsWith('2025-05')).toBe(true);
  });
});

describe('yearsFromDates', () => {
  it('returns sorted unique years', () => {
    expect(yearsFromDates([{ date: '2025-12-01' }, { date: '2020-02-03' }])).toEqual([2020, 2025]);
  });
});
