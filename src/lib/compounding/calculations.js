export function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

export function roundLots(value) {
  return Math.round(value * 100) / 100;
}

export function computeRiskAmount(balance, config) {
  return roundMoney(balance * (config.riskPercent / 100));
}

export function computeTargetProfit(balance, config) {
  return roundMoney(balance * (config.targetProfitPercent / 100));
}

export function computeRewardFromRisk(riskAmount, config) {
  return roundMoney(riskAmount * config.riskRewardRatio);
}

export function calculateLotSize(balance, config) {
  const riskAmount = computeRiskAmount(balance, config);

  switch (config.lotSizeMethod) {
    case 'fixed_risk_pips': {
      if (!config.stopLossPips || config.stopLossPips <= 0) return 0;
      const pipValue = config.pipValuePerLot || 10;
      return roundLots(riskAmount / (config.stopLossPips * pipValue));
    }
    case 'fixed_risk_points': {
      if (!config.stopLossPoints || config.stopLossPoints <= 0) return 0;
      const pointValue = config.pointValuePerLot || 1;
      return roundLots(riskAmount / (config.stopLossPoints * pointValue));
    }
    case 'percent_of_balance':
      return roundLots((balance * config.riskPercent) / 100 / 100);
    default:
      return 0;
  }
}

export function getActiveTierForStep(stepIndex, config) {
  if (!config) return null;
  const tiers = config.riskTiers || config.tiers;
  if (tiers && Array.isArray(tiers) && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => a.from - b.from);
    let active = sorted.find((t) => stepIndex >= t.from && stepIndex <= t.to);
    if (!active) {
      if (stepIndex < sorted[0].from) active = sorted[0];
      else active = sorted[sorted.length - 1];
    }
    return active;
  }

  // Default Spreadsheet De-escalation Tiers fallback if plan targets ~$11,873 or has initial 60% profit / 10% risk
  const isSpreadsheetPlan =
    config.targetProfitPercent === 60 ||
    Math.abs((config.targetBalance || 0) - 11873.02) < 50;

  if (isSpreadsheetPlan) {
    if (stepIndex >= 1 && stepIndex <= 4) return { lossCushion: 10, rr: 6 };
    if (stepIndex >= 5 && stepIndex <= 8) return { lossCushion: 20, rr: 6 };
    if (stepIndex >= 9 && stepIndex <= 12) return { lossCushion: 30, rr: 6 };
    if (stepIndex >= 13) return { lossCushion: 40, rr: 6 };
  }

  return null;
}

export function computeTradePreview(balance, config, stepIndex = 1) {
  const tier = getActiveTierForStep(stepIndex, config);
  let effectiveRiskPercent = config?.riskPercent ?? 10;
  let effectiveTargetProfitPercent = config?.targetProfitPercent ?? 60;

  if (tier) {
    const lossCushion = tier.lossCushion || 10;
    const rr = tier.rr || config?.riskRewardRatio || 6;
    effectiveRiskPercent = 100 / lossCushion;
    effectiveTargetProfitPercent = (100 / lossCushion) * rr;
  }

  const riskAmount = roundMoney(balance * (effectiveRiskPercent / 100));
  const targetProfit = roundMoney(balance * (effectiveTargetProfitPercent / 100));
  
  // Calculate suggested lot size using effective risk amount
  let suggestedLotSize = 0;
  if (config?.stopLossPips && config.stopLossPips > 0) {
    const pipValue = config.pipValuePerLot || 10;
    suggestedLotSize = roundLots(riskAmount / (config.stopLossPips * pipValue));
  } else {
    suggestedLotSize = roundLots((balance * effectiveRiskPercent) / 100 / 100);
  }

  return {
    riskAmount,
    targetProfit,
    suggestedLotSize,
    riskPercent: effectiveRiskPercent,
    targetProfitPercent: effectiveTargetProfitPercent,
  };
}

export function resolveActualPL(balanceBefore, config, result, customPL, stepIndex = 1) {
  if (customPL !== undefined && !Number.isNaN(customPL)) {
    return roundMoney(customPL);
  }
  const preview = computeTradePreview(balanceBefore, config, stepIndex);
  if (result === 'win') return preview.targetProfit;
  if (result === 'loss') return -preview.riskAmount;
  return 0;
}

export function rebuildTradeChain(config, trades) {
  let balance = config.startingBalance;

  return trades.map((trade, index) => {
    const stepIndex = index + 1;
    const preview = computeTradePreview(balance, config, stepIndex);
    const balanceBefore = balance;
    const actualPL = resolveActualPL(
      balanceBefore,
      config,
      trade.result,
      trade.useManualPL ? trade.actualPL : undefined,
      stepIndex,
    );
    const balanceAfter = roundMoney(balanceBefore + actualPL);
    balance = balanceAfter;

    return {
      ...trade,
      tradeNumber: stepIndex,
      balanceBefore,
      suggestedLotSize: preview.suggestedLotSize,
      riskAmount: preview.riskAmount,
      targetProfit: preview.targetProfit,
      actualPL,
      balanceAfter,
    };
  });
}

export function getCurrentBalance(config, trades) {
  if (trades.length === 0) return config.startingBalance;
  return trades[trades.length - 1].balanceAfter;
}

export function computeStreaks(trades) {
  let currentStreak = 0;
  let currentStreakType = 'none';
  let bestWinStreak = 0;
  let tempWin = 0;

  for (const trade of trades) {
    if (trade.result === 'win') {
      tempWin += 1;
      if (currentStreakType === 'win') currentStreak += 1;
      else {
        currentStreak = 1;
        currentStreakType = 'win';
      }
      bestWinStreak = Math.max(bestWinStreak, tempWin);
    } else if (trade.result === 'loss') {
      tempWin = 0;
      if (currentStreakType === 'loss') currentStreak += 1;
      else {
        currentStreak = 1;
        currentStreakType = 'loss';
      }
    } else {
      tempWin = 0;
      currentStreak = 0;
      currentStreakType = 'none';
    }
  }

  return { currentStreak, currentStreakType, bestWinStreak };
}

export function computeDrawdown(trades, startingBalance) {
  let peak = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const trade of trades) {
    const balance = trade.balanceAfter;
    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);
  }

  return {
    largestDrawdown: roundMoney(maxDrawdown),
    largestDrawdownPercent: roundMoney(maxDrawdownPercent),
  };
}

export function computeStats(config, trades) {
  const currentBalance = getCurrentBalance(config, trades);
  const wins = trades.filter((t) => t.result === 'win');
  const losses = trades.filter((t) => t.result === 'loss');
  const breakeven = trades.filter((t) => t.result === 'breakeven');

  const totalProfit = roundMoney(wins.reduce((sum, t) => sum + Math.max(0, t.actualPL), 0));
  const totalLoss = roundMoney(losses.reduce((sum, t) => sum + Math.abs(Math.min(0, t.actualPL)), 0));
  const netProfit = roundMoney(currentBalance - config.startingBalance);

  const winRate = trades.length > 0 ? roundMoney((wins.length / trades.length) * 100) : 0;
  const { currentStreak, currentStreakType, bestWinStreak } = computeStreaks(trades);
  const { largestDrawdown, largestDrawdownPercent } = computeDrawdown(trades, config.startingBalance);

  const range = config.targetBalance - config.startingBalance;
  const progressPercent =
    range > 0
      ? roundMoney(Math.min(100, Math.max(0, ((currentBalance - config.startingBalance) / range) * 100)))
      : 0;

  const averageWin = wins.length > 0 ? roundMoney(totalProfit / wins.length) : 0;
  const averageLoss = losses.length > 0 ? roundMoney(totalLoss / losses.length) : 0;
  const profitFactor = totalLoss > 0 ? roundMoney(totalProfit / totalLoss) : totalProfit > 0 ? Infinity : 0;
  const expectedValue =
    trades.length > 0
      ? roundMoney((winRate / 100) * averageWin - ((100 - winRate) / 100) * averageLoss)
      : 0;

  return {
    currentBalance,
    targetBalance: config.targetBalance,
    remainingAmount: roundMoney(Math.max(0, config.targetBalance - currentBalance)),
    totalProfit,
    totalLoss,
    netProfit,
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: breakeven.length,
    winRate,
    currentStreak,
    currentStreakType,
    bestWinStreak,
    largestDrawdown,
    largestDrawdownPercent,
    progressPercent,
    averageWin,
    averageLoss,
    profitFactor,
    expectedValue,
  };
}
