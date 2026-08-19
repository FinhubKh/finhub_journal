import { normalizePnlDenomination } from './format';

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Decode MT5 HTML bytes (reports are often UTF-16 LE with a BOM). */
export function decodeMt5ReportText(input) {
  if (typeof input === 'string') {
    return input.includes('\u0000') ? input.replace(/\u0000/g, '') : input;
  }
  const bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input || []);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export function parseMt5Number(value) {
  const raw = String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  if (!raw || raw === '—' || raw === '-') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function parseMt5Date(value) {
  const m = String(value || '').match(/^(\d{4})[.](\d{2})[.](\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function settingValue(html, label) {
  const re = new RegExp(
    `${label}:</td>\\s*<td[^>]*>\\s*<b>([\\s\\S]*?)</b>`,
    'i',
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : '';
}

function detectCurrency(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return { currency: 'usd', warning: true };
  if (/\b(usc|cent|cents)\b/.test(v)) return { currency: 'cent', warning: false };
  if (/\busd\b/.test(v) || v === 'us dollar' || v === 'dollar') {
    return { currency: 'usd', warning: false };
  }
  return { currency: normalizePnlDenomination(v), warning: true };
}

function extractTdTexts(rowHtml) {
  const out = [];
  const re = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = re.exec(rowHtml))) {
    out.push(stripTags(m[1]));
  }
  return out;
}

function dealsSection(html) {
  const marker = html.search(/<b>\s*Deals\s*<\/b>/i);
  if (marker < 0) return '';
  const rest = html.slice(marker);
  const nextSection = rest.search(/<b>\s*(Orders|Graph|Results)\s*<\/b>/i);
  return nextSection > 0 ? rest.slice(0, nextSection) : rest;
}

function parsePeriodRange(period) {
  const m = String(period || '').match(
    /(\d{4}[.]\d{2}[.]\d{2})\s*-\s*(\d{4}[.]\d{2}[.]\d{2})/,
  );
  return {
    rangeFrom: m ? parseMt5Date(m[1]) : null,
    rangeTo: m ? parseMt5Date(m[2]) : null,
  };
}

/**
 * Parse an MT5 Strategy Tester HTML report into overview stats + daily PnL.
 * Realized PnL comes from Deals rows where Direction is "out".
 */
export function parseMt5StrategyTesterHtml(html) {
  const text = decodeMt5ReportText(html);
  if (!text || typeof text !== 'string') {
    throw new Error('Upload a Strategy Tester HTML report.');
  }
  if (!/Strategy Tester Report/i.test(text) && !/<b>\s*Deals\s*<\/b>/i.test(text)) {
    throw new Error('This file does not look like an MT5 Strategy Tester report.');
  }

  const expert = settingValue(text, 'Expert');
  const symbol = settingValue(text, 'Symbol');
  const period = settingValue(text, 'Period');
  const { rangeFrom, rangeTo } = parsePeriodRange(period);
  const currencyRaw = settingValue(text, 'Currency');
  const { currency, warning: currencyWarning } = detectCurrency(currencyRaw);
  const reportNetProfit = parseMt5Number(settingValue(text, 'Total Net Profit'));
  const reportProfitFactor = parseMt5Number(settingValue(text, 'Profit Factor'));
  const reportTotalTrades = parseMt5Number(settingValue(text, 'Total Trades'));
  const initialDeposit = parseMt5Number(settingValue(text, 'Initial Deposit'));
  
  // New Advanced Metrics
  const sharpeRatio = parseMt5Number(settingValue(text, 'Sharpe Ratio'));
  const recoveryFactor = parseMt5Number(settingValue(text, 'Recovery Factor'));
  
  const rawMaxDd = settingValue(text, 'Equity Drawdown Maximal');
  const maxDdMatch = rawMaxDd.match(/([\d\s\.,]+)\s*\(([\d\.]+)\%\)/);
  const maxDdAmount = maxDdMatch ? parseMt5Number(maxDdMatch[1]) : parseMt5Number(rawMaxDd);
  const maxDdPercent = maxDdMatch ? Number(maxDdMatch[2]) : 0;

  const largestLoss = parseMt5Number(settingValue(text, 'Largest loss trade'));
  const maxConsWinsRaw = settingValue(text, 'Maximum consecutive wins \\(\\$?\\)');
  const maxConsWins = maxConsWinsRaw ? parseInt(maxConsWinsRaw.split(' ')[0], 10) : 0;
  const maxConsLossesRaw = settingValue(text, 'Maximum consecutive losses \\(\\$?\\)');
  const maxConsLosses = maxConsLossesRaw ? parseInt(maxConsLossesRaw.split(' ')[0], 10) : 0;

  const longTradesRaw = settingValue(text, 'Long Trades \\(won %\\)');
  const longMatch = longTradesRaw.match(/(\d+)\s*\(([\d\.]+)\%\)/);
  const longCount = longMatch ? parseInt(longMatch[1], 10) : 0;
  const longWr = longMatch ? Number(longMatch[2]) : 0;

  const shortTradesRaw = settingValue(text, 'Short Trades \\(won %\\)');
  const shortMatch = shortTradesRaw.match(/(\d+)\s*\(([\d\.]+)\%\)/);
  const shortCount = shortMatch ? parseInt(shortMatch[1], 10) : 0;
  const shortWr = shortMatch ? Number(shortMatch[2]) : 0;

  const dealsHtml = dealsSection(text);
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const dailyMap = new Map();
  let tradeCount = 0;
  let wins = 0;
  let losses = 0;
  let beCount = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let parsedOutDeals = 0;
  let maxTradeProfit = 0;

  const sessionBreakdownMap = new Map();
  const symbolBreakdownMap = new Map();
  const directionBreakdownMap = new Map();

  let row;
  while ((row = rowRe.exec(dealsHtml))) {
    const cells = extractTdTexts(row[1]);
    if (cells.length < 11) continue;
    if (/^time$/i.test(cells[0])) continue;
    const type = (cells[3] || '').toLowerCase();
    const direction = (cells[4] || '').toLowerCase();
    if (type === 'balance' || type === 'credit') continue;
    if (direction !== 'out') continue;

    const date = parseMt5Date(cells[0]);
    if (!date) continue;
    const commission = parseMt5Number(cells[8]);
    const swap = parseMt5Number(cells[9]);
    const profit = parseMt5Number(cells[10]) + commission + swap;
    parsedOutDeals += 1;
    tradeCount += 1;

    if (profit > maxTradeProfit) {
      maxTradeProfit = profit;
    }

    const tradeSymbol = symbol || 'Unknown';
    if (!symbolBreakdownMap.has(tradeSymbol)) {
      symbolBreakdownMap.set(tradeSymbol, { count: 0, wins: 0, pnl: 0 });
    }
    const symObj = symbolBreakdownMap.get(tradeSymbol);
    symObj.count += 1;
    symObj.pnl += profit;
    if (profit > 0) symObj.wins += 1;

    const timeMatch = cells[0].match(/ (\d{2}):/);
    const hour = timeMatch ? parseInt(timeMatch[1], 10) : 0;
    let sessionName = 'asia';
    if (hour >= 8 && hour < 13) sessionName = 'london';
    else if (hour >= 13 && hour < 22) sessionName = 'new york';
    
    if (!sessionBreakdownMap.has(sessionName)) {
      sessionBreakdownMap.set(sessionName, { count: 0, wins: 0, pnl: 0 });
    }
    const sessObj = sessionBreakdownMap.get(sessionName);
    sessObj.count += 1;
    sessObj.pnl += profit;
    if (profit > 0) sessObj.wins += 1;

    const tradeDir = (type === 'buy' || type === 'long') ? 'Long (Buy)' : (type === 'sell' || type === 'short') ? 'Short (Sell)' : 'Unknown';
    if (!directionBreakdownMap.has(tradeDir)) {
      directionBreakdownMap.set(tradeDir, { count: 0, wins: 0, pnl: 0 });
    }
    const dirObj = directionBreakdownMap.get(tradeDir);
    dirObj.count += 1;
    dirObj.pnl += profit;
    if (profit > 0) dirObj.wins += 1;

    if (profit > 0) {
      wins += 1;
      grossWin += profit;
    } else if (profit < 0) {
      losses += 1;
      grossLoss += Math.abs(profit);
    } else {
      beCount += 1;
    }

    const existing = dailyMap.get(date) || {
      date,
      pnl_usd: 0,
      trade_count: 0,
      wins: 0,
      losses: 0,
      be_count: 0,
    };
    existing.pnl_usd += profit;
    existing.trade_count += 1;
    if (profit > 0) existing.wins += 1;
    else if (profit < 0) existing.losses += 1;
    else existing.be_count += 1;
    dailyMap.set(date, existing);
  }

  if (parsedOutDeals === 0) {
    throw new Error('No closed deals found in this report. Make sure you uploaded the full Strategy Tester HTML.');
  }

  const daily = [...dailyMap.values()]
    .map((d) => ({
      ...d,
      pnl_usd: Math.round(d.pnl_usd * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dates = daily.map((d) => d.date);
  const roundedTotal = Math.round(daily.reduce((s, d) => s + d.pnl_usd, 0) * 100) / 100;
  const pf = grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : (grossWin > 0 ? Infinity : 0);

  return {
    name: expert || 'Strategy backtest',
    expert: expert || null,
    symbol: symbol || null,
    period: period || null,
    currency,
    currencyRaw: currencyRaw || null,
    currencyWarning,
    initialDeposit,
    reportTotalTrades: reportTotalTrades || null,
    rangeFrom: rangeFrom || dates[0] || null,
    rangeTo: rangeTo || dates[dates.length - 1] || null,
    totalPnl: roundedTotal,
    reportNetProfit,
    reportProfitFactor: reportProfitFactor || null,
    tradeCount,
    wins,
    losses,
    beCount,
    grossWin: Math.round(grossWin * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor: pf === Infinity ? null : pf,
    profitFactorInfinite: pf === Infinity,
    wr: tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0,
    breakdown: {
      symbol: Array.from(symbolBreakdownMap.entries()).map(([name, obj]) => ({
        name,
        count: obj.count,
        pnl: Math.round(obj.pnl * 100) / 100,
        wr: obj.count > 0 ? Math.round((obj.wins / obj.count) * 100) : 0,
      })),
      session: Array.from(sessionBreakdownMap.entries()).map(([name, obj]) => ({
        name,
        count: obj.count,
        pnl: Math.round(obj.pnl * 100) / 100,
        wr: obj.count > 0 ? Math.round((obj.wins / obj.count) * 100) : 0,
      })),
      direction: Array.from(directionBreakdownMap.entries()).map(([name, obj]) => ({
        name,
        count: obj.count,
        pnl: Math.round(obj.pnl * 100) / 100,
        wr: obj.count > 0 ? Math.round((obj.wins / obj.count) * 100) : 0,
      })),
      outcome: [
        { name: 'Winning trades', count: wins, pnl: Math.round(grossWin * 100) / 100, wr: 100 },
        { name: 'Losing trades', count: losses, pnl: -Math.round(grossLoss * 100) / 100, wr: 0 },
      ],
      maxTradeProfit: Math.round(maxTradeProfit * 100) / 100,
      sharpeRatio,
      recoveryFactor,
      maxDdAmount,
      maxDdPercent,
      largestLoss,
      maxConsWins,
      maxConsLosses,
      longCount,
      longWr,
      shortCount,
      shortWr,
      initialDeposit: initialDeposit || 0,
    },
    daily,
  };
}

export function dailyRowsForCalendar(daily) {
  return (daily || []).map((d) => ({
    date: d.date,
    pnl: Number(d.pnl_usd) || 0,
    trades: Number(d.trade_count) || 0,
    wins: Number(d.wins) || 0,
    losses: Number(d.losses) || 0,
    be_count: Number(d.be_count) || 0,
  }));
}
