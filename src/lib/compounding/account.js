import { DEFAULT_CONFIG } from './types';

export function accountToConfig(account) {
  let horizon = account.timeHorizon || account.time_horizon || account.time_horizon_weeks;
  if (!horizon && account.name) {
    const match = account.name.match(/(\d+)\s*(week|wk|mo|month|weel)s?/i);
    if (match) {
      horizon = Number(match[1]);
    }
  }

  return {
    startingBalance: Number(account.startingBalance),
    targetBalance: Number(account.targetBalance),
    targetProfitPercent: Number(account.targetProfitPercent),
    riskPercent: Number(account.riskPercent ?? DEFAULT_CONFIG.riskPercent),
    riskRewardRatio: Number(account.riskRewardRatio ?? DEFAULT_CONFIG.riskRewardRatio),
    timeHorizon: horizon ? Number(horizon) : undefined,
    stopLossPips: account.stopLossPips != null ? Number(account.stopLossPips) : DEFAULT_CONFIG.stopLossPips,
    stopLossPoints: account.stopLossPoints != null ? Number(account.stopLossPoints) : undefined,
    lotSizeMethod: account.lotSizeMethod || DEFAULT_CONFIG.lotSizeMethod,
    pipValuePerLot: Number(account.pipValuePerLot ?? DEFAULT_CONFIG.pipValuePerLot),
    pointValuePerLot: Number(account.pointValuePerLot ?? DEFAULT_CONFIG.pointValuePerLot),
  };
}

export function formatAccountSummary(account) {
  return `${account.targetProfitPercent}% per win · grow to target`;
}
