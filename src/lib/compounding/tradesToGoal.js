import { tradesNeededToTarget } from './projection';

export function getTradesToGoalSummary(config, currentBalance) {
  const atGoal = currentBalance >= config.targetBalance;
  const winsFromStart = tradesNeededToTarget(config, config.startingBalance);
  const winsRemaining = atGoal ? 0 : tradesNeededToTarget(config, currentBalance);

  return {
    atGoal,
    winsFromStart,
    winsRemaining,
    totalWinsIfAllWinFromStart: winsFromStart,
  };
}
