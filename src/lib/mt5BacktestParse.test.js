import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseMt5Number, parseMt5StrategyTesterHtml } from './mt5BacktestParse.js';

const SAMPLE = [
  resolve(process.cwd(), '../ReportTester-308040.html'),
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../ReportTester-308040.html'),
].find((p) => existsSync(p));

const MINI_REPORT = `<html><body>
  <div>Strategy Tester Report</div>
  <td>Expert:</td><td><b>MiniEA</b></td>
  <td>Symbol:</td><td><b>XAUUSD</b></td>
  <td>Period:</td><td><b>M5 (2025.05.16 - 2025.05.16)</b></td>
  <td>Currency:</td><td><b>USD</b></td>
  <td>Total Net Profit:</td><td><b>12.50</b></td>
  <b>Deals</b>
  <table>
    <tr><td>Time</td><td>Deal</td><td>Symbol</td><td>Type</td><td>Direction</td><td>Volume</td><td>Price</td><td>Order</td><td>Commission</td><td>Swap</td><td>Profit</td><td>Balance</td><td>Comment</td></tr>
    <tr><td>2025.05.16 08:00:00</td><td>1</td><td></td><td>balance</td><td></td><td></td><td></td><td></td><td>0.00</td><td>0.00</td><td>1 000.00</td><td>1 000.00</td><td></td></tr>
    <tr><td>2025.05.16 08:30:00</td><td>2</td><td>XAUUSD</td><td>buy</td><td>in</td><td>0.1</td><td>2300</td><td>2</td><td>0.00</td><td>0.00</td><td>0.00</td><td>1 000.00</td><td></td></tr>
    <tr><td>2025.05.16 09:00:00</td><td>3</td><td>XAUUSD</td><td>sell</td><td>out</td><td>0.1</td><td>2310</td><td>3</td><td>0.00</td><td>0.00</td><td>10.00</td><td>1 010.00</td><td></td></tr>
    <tr><td>2025.05.16 10:00:00</td><td>4</td><td>XAUUSD</td><td>sell</td><td>in</td><td>0.1</td><td>2310</td><td>4</td><td>0.00</td><td>0.00</td><td>0.00</td><td>1 010.00</td><td></td></tr>
    <tr><td>2025.05.16 11:00:00</td><td>5</td><td>XAUUSD</td><td>buy</td><td>out</td><td>0.1</td><td>2308</td><td>5</td><td>-0.50</td><td>3.00</td><td>0.00</td><td>1 012.50</td><td></td></tr>
  </table>
</body></html>`;

describe('parseMt5Number', () => {
  it('strips thousand separators used in MT5 HTML', () => {
    expect(parseMt5Number('602 559.36')).toBe(602559.36);
    expect(parseMt5Number('-1 092.93')).toBe(-1092.93);
    expect(parseMt5Number('')).toBe(0);
  });
});

describe('parseMt5StrategyTesterHtml', () => {
  it('aggregates out-deals and includes commission plus swap', () => {
    const parsed = parseMt5StrategyTesterHtml(MINI_REPORT);
    expect(parsed.currency).toBe('usd');
    expect(parsed.currencyWarning).toBe(false);
    expect(parsed.tradeCount).toBe(2);
    expect(parsed.wins).toBe(2);
    expect(parsed.totalPnl).toBe(12.5);
    expect(parsed.daily).toEqual([
      {
        date: '2025-05-16',
        pnl_usd: 12.5,
        trade_count: 2,
        wins: 2,
        losses: 0,
        be_count: 0,
      },
    ]);
    expect(parsed.trades).toHaveLength(2);
    expect(parsed.trades[0]).toMatchObject({
      date: '2025-05-16',
      time: '09:00:00',
      symbol: 'XAUUSD',
      direction: 'long',
      volume: 0.1,
      pnl_usd: 10,
      result: 'win',
      session: 'london',
    });
    expect(parsed.trades[1]).toMatchObject({
      date: '2025-05-16',
      time: '11:00:00',
      direction: 'short',
      pnl_usd: 2.5,
      result: 'win',
    });
  });

  it('parses ReportTester-308040.html to match report totals', () => {
    expect(SAMPLE, 'expected ReportTester-308040.html next to the journal folder').toBeTruthy();
    const html = readFileSync(SAMPLE);
    const parsed = parseMt5StrategyTesterHtml(html);
    expect(parsed.name).toBe('OneCERSIEntry');
    expect(parsed.symbol).toBe('XAUUSD');
    expect(parsed.currency).toBe('usd');
    expect(parsed.tradeCount).toBe(745);
    expect(parsed.reportTotalTrades).toBe(745);
    expect(parsed.totalPnl).toBeCloseTo(parsed.reportNetProfit, 2);
    expect(parsed.totalPnl).toBeCloseTo(602559.36, 2);
    expect(parsed.daily.reduce((s, d) => s + d.pnl_usd, 0)).toBeCloseTo(parsed.totalPnl, 2);
    expect(parsed.rangeFrom).toBe('2020-02-01');
    expect(parsed.rangeTo).toBe('2025-12-31');
  });
});
