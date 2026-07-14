import { roundMoney } from './calculations';

export function buildEquityCurve(startingBalance, trades) {
  const points = [{ label: 'Start', balance: startingBalance, tradeNumber: 0 }];
  for (const trade of trades) {
    points.push({
      label: `#${trade.tradeNumber}`,
      balance: trade.balanceAfter,
      tradeNumber: trade.tradeNumber,
    });
  }
  return points;
}

export function buildDrawdownSeries(startingBalance, trades) {
  let peak = startingBalance;
  const points = [{ label: 'Start', drawdown: 0, drawdownPercent: 0 }];

  for (const trade of trades) {
    const balance = trade.balanceAfter;
    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    points.push({
      label: `#${trade.tradeNumber}`,
      drawdown: roundMoney(drawdown),
      drawdownPercent: roundMoney(drawdownPercent),
    });
  }
  return points;
}

export function buildWinLossDistribution(trades) {
  const wins = trades.filter((t) => t.result === 'win').length;
  const losses = trades.filter((t) => t.result === 'loss').length;
  const breakeven = trades.filter((t) => t.result === 'breakeven').length;
  return [
    { name: 'Wins', value: wins, color: '#059669' },
    { name: 'Losses', value: losses, color: '#e11d48' },
    { name: 'Breakeven', value: breakeven, color: '#a1a1aa' },
  ];
}

function groupByPeriod(trades, mode) {
  const map = new Map();

  for (const trade of trades) {
    const date = new Date(`${trade.date}T12:00:00`);
    const key =
      mode === 'daily'
        ? trade.date
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = map.get(key) ?? { profit: 0, trades: 0 };
    existing.profit += trade.actualPL;
    existing.trades += 1;
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({
      period,
      profit: roundMoney(data.profit),
      trades: data.trades,
    }));
}

export function buildDailyProfit(trades) {
  return groupByPeriod(trades, 'daily');
}

export function buildMonthlyProfit(trades) {
  return groupByPeriod(trades, 'monthly');
}
