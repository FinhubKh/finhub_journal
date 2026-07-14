import { computeTradePreview, getCurrentBalance, roundMoney } from './calculations';

export function buildSpreadsheetRows(config, trades, projectionCount = 15) {
  const rows = [];

  for (const trade of trades) {
    const preview = computeTradePreview(trade.balanceBefore, config);
    rows.push({
      tradeNumber: trade.tradeNumber,
      balanceBefore: trade.balanceBefore,
      profitNeeded: trade.targetProfit,
      riskAmount: preview.riskAmount,
      balanceAfterWin: roundMoney(trade.balanceBefore + preview.targetProfit),
      balanceAfterLoss: roundMoney(trade.balanceBefore - preview.riskAmount),
      balanceAfterActual: trade.balanceAfter,
      lotSize: trade.suggestedLotSize,
      status: 'completed',
      result: trade.result,
      tradeId: trade.id,
      date: trade.date,
      actualPL: trade.actualPL,
      calendarTrades: trade.calendarTrades,
      calendarWinTrades: trade.calendarWinTrades,
      calendarLossTrades: trade.calendarLossTrades,
      isProjection: false,
    });
  }

  let balance = getCurrentBalance(config, trades);
  const startNumber = trades.length + 1;
  let tradeNumber = startNumber;

  while (tradeNumber <= startNumber + projectionCount - 1 && balance < config.targetBalance) {
    const preview = computeTradePreview(balance, config);
    const isCurrent = tradeNumber === startNumber;

    rows.push({
      tradeNumber,
      balanceBefore: balance,
      profitNeeded: preview.targetProfit,
      riskAmount: preview.riskAmount,
      balanceAfterWin: roundMoney(balance + preview.targetProfit),
      balanceAfterLoss: roundMoney(balance - preview.riskAmount),
      lotSize: preview.suggestedLotSize,
      status: isCurrent ? 'current' : 'pending',
      isProjection: true,
    });

    balance = roundMoney(balance + preview.targetProfit);
    tradeNumber += 1;
  }

  return rows;
}

export function tradesNeededToTarget(config, fromBalance) {
  let balance = fromBalance ?? config.startingBalance;
  let count = 0;
  const max = 500;
  while (balance < config.targetBalance && count < max) {
    const preview = computeTradePreview(balance, config);
    balance = roundMoney(balance + preview.targetProfit);
    count += 1;
  }
  return count;
}
