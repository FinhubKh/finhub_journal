import { describe, expect, it } from 'vitest';
import { compareRowsNewestFirst, mergeCashflowsIntoPage } from './tradeLog.js';

describe('compareRowsNewestFirst', () => {
  it('puts the later close time first even on the same date', () => {
    const morning = { id: 'a', date: '2026-08-17', close_time: '2026-08-17T09:00:00Z' };
    const evening = { id: 'b', date: '2026-08-17', close_time: '2026-08-17T18:00:00Z' };
    expect([morning, evening].sort(compareRowsNewestFirst).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('does not use created_at when close_time exists', () => {
    const olderClose = {
      id: 'old',
      date: '2026-08-17',
      close_time: '2026-08-17T10:00:00Z',
      created_at: '2026-08-17T23:00:00Z',
    };
    const newerClose = {
      id: 'new',
      date: '2026-08-17',
      close_time: '2026-08-17T16:00:00Z',
      created_at: '2026-08-17T16:05:00Z',
    };
    expect([olderClose, newerClose].sort(compareRowsNewestFirst).map((r) => r.id)).toEqual(['new', 'old']);
  });
});

describe('mergeCashflowsIntoPage', () => {
  it('interleaves deposits by time so the latest row is on top', () => {
    const trades = [
      { id: 't1', date: '2026-08-17', close_time: '2026-08-17T16:00:00Z' },
      { id: 't2', date: '2026-08-16', close_time: '2026-08-16T12:00:00Z' },
    ];
    const cashflows = [
      { id: 'c1', date: '2026-08-17', occurred_at: '2026-08-17T18:00:00Z', op_type: 'deposit', amount: 1000 },
      { id: 'c2', date: '2026-08-17', occurred_at: '2026-08-17T08:00:00Z', op_type: 'withdrawal', amount: -100 },
    ];
    const rows = mergeCashflowsIntoPage(trades, cashflows, { pageSafe: 1, totalPages: 1 });
    expect(rows.map((r) => r.id)).toEqual(['cash-c1', 't1', 'cash-c2', 't2']);
  });

  it('shows only matching cashflows when filtering deposits', () => {
    const trades = [{ id: 't1', date: '2026-08-17', close_time: '2026-08-17T16:00:00Z' }];
    const cashflows = [
      { id: 'c1', date: '2026-08-17', occurred_at: '2026-08-17T18:00:00Z', op_type: 'deposit', amount: 1000 },
    ];
    const rows = mergeCashflowsIntoPage(trades, cashflows, { cashOnly: true });
    expect(rows.map((r) => r.id)).toEqual(['cash-c1']);
    expect(rows[0].result).toBe('deposit');
  });
});
