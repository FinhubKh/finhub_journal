import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import {
  buildDailyProfit,
  buildDrawdownSeries,
  buildEquityCurve,
  buildMonthlyProfit,
  buildWinLossDistribution,
} from '../../lib/compounding/analytics';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { card, cardBody, cardHd, cardTitle, emptyState } from '../../lib/ui';

function StatChip({ label, value, tone }) {
  const toneClass =
    tone === 'profit' ? 'text-emerald-600' : tone === 'loss' ? 'text-rose-600' : 'text-zinc-900';
  return (
    <div className={`${card} px-4 py-3`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function LineChartCard({ title, labels, values, color, emptyMessage, valueFormatter }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!labels.length) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return;
    }
    if (chartRef.current) chartRef.current.destroy();
    const fmt = valueFormatter || ((v) => String(v));
    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: color,
            borderWidth: 2,
            pointRadius: 2,
            fill: true,
            backgroundColor: `${color}14`,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => fmt(ctx.raw),
            },
          },
        },
        scales: {
          x: { ticks: { color: '#a1a1aa', maxRotation: 0 }, grid: { display: false } },
          y: {
            ticks: {
              color: '#a1a1aa',
              callback: (v) => fmt(v),
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
    // valueFormatter intentionally omitted — callers pass inline formatters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, values, color, emptyMessage]);

  return (
    <div className={card}>
      <div className={cardHd}>
        <h3 className={cardTitle}>{title}</h3>
      </div>
      <div className={`${cardBody} h-56`}>
        {!labels.length ? <div className={emptyState}>{emptyMessage}</div> : <canvas ref={canvasRef} />}
      </div>
    </div>
  );
}

export default function AnalyticsPanel({ config, trades, stats }) {
  const equity = buildEquityCurve(config.startingBalance, trades);
  const drawdown = buildDrawdownSeries(config.startingBalance, trades);
  const distribution = buildWinLossDistribution(trades);
  const daily = buildDailyProfit(trades);
  const monthly = buildMonthlyProfit(trades);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Avg win" value={formatMoney(stats.averageWin)} tone="profit" />
        <StatChip label="Avg loss" value={formatMoney(stats.averageLoss)} tone="loss" />
        <StatChip
          label="Profit factor"
          value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
        />
        <StatChip label="Expected value" value={formatMoney(stats.expectedValue)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LineChartCard
          title="Balance growth / equity"
          labels={equity.map((p) => p.label)}
          values={equity.map((p) => p.balance)}
          color="#7c3aed"
          emptyMessage="Log wins and losses on the plan to plot equity."
          valueFormatter={(v) => formatMoney(Number(v))}
        />
        <LineChartCard
          title="Drawdown"
          labels={drawdown.map((p) => p.label)}
          values={drawdown.map((p) => p.drawdown)}
          color="#e11d48"
          emptyMessage="No drawdown data yet."
          valueFormatter={(v) => formatMoney(Number(v))}
        />
        <LineChartCard
          title="Daily profit"
          labels={daily.map((p) => p.period)}
          values={daily.map((p) => p.profit)}
          color="#059669"
          emptyMessage="No daily P&L yet."
          valueFormatter={(v) => formatMoney(Number(v))}
        />
        <LineChartCard
          title="Monthly profit"
          labels={monthly.map((p) => p.period)}
          values={monthly.map((p) => p.profit)}
          color="#2563eb"
          emptyMessage="No monthly P&L yet."
          valueFormatter={(v) => formatMoney(Number(v))}
        />
      </div>

      <div className={`${card} ${cardBody}`}>
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">Win / loss distribution</h3>
        <div className="flex flex-wrap gap-3">
          {distribution.map((item) => (
            <div
              key={item.name}
              className="rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: item.color }}
            >
              <div className="text-zinc-500">{item.name}</div>
              <div className="text-lg font-semibold tabular-nums text-zinc-900">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
