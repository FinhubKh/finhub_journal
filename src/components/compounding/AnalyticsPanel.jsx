import { useMemo } from 'react';
import {
  buildDailyProfit,
  buildDrawdownSeries,
  buildEquityCurve,
  buildMonthlyProfit,
  buildWinLossDistribution,
} from '../../lib/compounding/analytics';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { card, cardBody, cardTitle } from '../../lib/ui';
import { DistributionChip, LineChartCard, MetricCard, SectionBlock } from './CompoundingUI';

function seriesFrom(points, labelKey, valueKey) {
  return {
    labels: points.map((p) => p[labelKey]),
    values: points.map((p) => p[valueKey]),
  };
}

export default function AnalyticsPanel({ config, trades, stats }) {
  const charts = useMemo(() => {
    const equity = buildEquityCurve(config.startingBalance, trades);
    const drawdown = buildDrawdownSeries(config.startingBalance, trades);
    const daily = buildDailyProfit(trades);
    const monthly = buildMonthlyProfit(trades);
    return {
      equity: seriesFrom(equity, 'label', 'balance'),
      drawdown: seriesFrom(drawdown, 'label', 'drawdown'),
      daily: seriesFrom(daily, 'period', 'profit'),
      monthly: seriesFrom(monthly, 'period', 'profit'),
      distribution: buildWinLossDistribution(trades),
    };
  }, [config.startingBalance, trades]);

  return (
    <div className="space-y-6">
      <SectionBlock title="Key metrics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Avg win" value={formatMoney(stats.averageWin)} tone="positive" size="sm" />
          <MetricCard label="Avg loss" value={formatMoney(stats.averageLoss)} tone="negative" size="sm" />
          <MetricCard
            label="Profit factor"
            value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
            size="sm"
          />
          <MetricCard label="Expected value" value={formatMoney(stats.expectedValue)} size="sm" />
        </div>
      </SectionBlock>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LineChartCard
          title="Balance growth / equity"
          labels={charts.equity.labels}
          values={charts.equity.values}
          color="#7c3aed"
          emptyMessage="Log wins and losses on the plan to plot equity."
        />
        <LineChartCard
          title="Drawdown"
          labels={charts.drawdown.labels}
          values={charts.drawdown.values}
          color="#e11d48"
          emptyMessage="No drawdown data yet."
        />
        <LineChartCard
          title="Daily profit"
          labels={charts.daily.labels}
          values={charts.daily.values}
          color="#7c3aed"
          emptyMessage="No daily P&L yet."
        />
        <LineChartCard
          title="Monthly profit"
          labels={charts.monthly.labels}
          values={charts.monthly.values}
          color="#2563eb"
          emptyMessage="No monthly P&L yet."
        />
      </div>

      <div className={`${card} ${cardBody}`}>
        <h3 className={`${cardTitle} mb-3`}>Win / loss distribution</h3>
        <div className="flex flex-wrap gap-3">
          {charts.distribution.map((item) => (
            <DistributionChip key={item.name} name={item.name} value={item.value} color={item.color} />
          ))}
        </div>
      </div>
    </div>
  );
}
