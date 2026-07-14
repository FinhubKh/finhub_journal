export const DEFAULT_CONFIG = {
  startingBalance: 20,
  targetBalance: 20000,
  targetProfitPercent: 10,
  riskPercent: 2,
  riskRewardRatio: 3,
  stopLossPips: 20,
  lotSizeMethod: 'fixed_risk_pips',
  pipValuePerLot: 10,
  pointValuePerLot: 1,
};

export const LOT_SIZE_METHODS = [
  { value: 'fixed_risk_pips', label: 'Fixed risk (pips)' },
  { value: 'fixed_risk_points', label: 'Fixed risk (points)' },
  { value: 'percent_of_balance', label: '% of balance (estimate)' },
];

export const PL_SOURCES = [
  { value: 'calculated', label: 'Calculated (% steps)' },
  { value: 'calendar', label: 'Calendar day P&L' },
];
