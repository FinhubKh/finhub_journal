const STANDARD_MILESTONES = [
  20, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 50000, 100000, 250000, 500000, 1000000,
];

export function generateMilestones(startingBalance, targetBalance) {
  if (targetBalance <= startingBalance) {
    return [startingBalance, targetBalance].filter((v, i, arr) => arr.indexOf(v) === i);
  }

  const milestones = new Set([startingBalance]);

  for (const value of STANDARD_MILESTONES) {
    if (value > startingBalance && value < targetBalance) {
      milestones.add(value);
    }
  }

  let cursor = startingBalance;
  while (cursor < targetBalance) {
    const next = cursor < 100 ? cursor * 2.5 : cursor < 1000 ? cursor * 2 : cursor * 1.5;
    const rounded = Math.round(next);
    if (rounded > cursor && rounded < targetBalance) {
      milestones.add(rounded);
    }
    cursor = rounded;
    if (cursor >= targetBalance) break;
  }

  milestones.add(targetBalance);
  return Array.from(milestones).sort((a, b) => a - b);
}

export function getNextMilestone(milestones, currentBalance) {
  return milestones.find((m) => m > currentBalance) ?? null;
}
