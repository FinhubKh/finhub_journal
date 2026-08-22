import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { fmtPnlStrict, moneySymbol, toDisplayPnl } from '../../lib/format';
import { normalizePnlDenomination } from '../../lib/accounts';
import { buildSeries, pointsFromProps } from '../../lib/equityChart';
import { card, cardBody, cardHd, cardTitle, emptyState } from '../../lib/ui';

const CHART_FONT = 'ui-sans-serif, system-ui, sans-serif';

export default function EquityChart({ daily, trades, denomination = 'usd', initialDeposit = 0, fill = false, action = null, isModal = false, onClose = null }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const denom = normalizePnlDenomination(denomination);
  const points = useMemo(() => pointsFromProps(daily, trades), [daily, trades]);

  const empty = points.length === 0;

  const lastVal = useMemo(() => {
    if (empty) return null;
    return points.reduce((s, t) => s + toDisplayPnl(t.pnl || 0, denom), 0) + initialDeposit;
  }, [points, empty, denom, initialDeposit]);

  useEffect(() => () => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (empty) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return;
    }

    const { labels, dataUsd, peakUsd } = buildSeries(points, denom, initialDeposit);
    const showPoints = labels.length <= 3;
    const labelFmt = (v) => {
      const sym = moneySymbol(denom);
      return v >= 0 ? `+${sym}${Number(v).toFixed(2)}` : `-${sym}${Math.abs(Number(v)).toFixed(2)}`;
    };

    if (chartRef.current) {
      const chart = chartRef.current;
      chart.data.labels = labels;
      chart.data.datasets[0].data = dataUsd;
      chart.data.datasets[0].pointRadius = showPoints ? 4 : 0;
      chart.options.scales.y.ticks.callback = labelFmt;
      chart.options.plugins.tooltip.callbacks.label = (ctx) => labelFmt(ctx.raw);

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const redColor = isDark ? '#fb7185' : '#e11d48';
      chart.data.datasets[0].segment = {
        borderColor: (ctx) => {
          if (!ctx.p1DataIndex) return undefined;
          const val = dataUsd[ctx.p1DataIndex];
          const peak = peakUsd[ctx.p1DataIndex];
          return val < peak ? redColor : undefined;
        }
      };

      chart.update('none');
      return;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const accentColor = isDark ? '#4ade80' : '#7c3aed';
    const fillColor = isDark ? 'rgba(74, 222, 128, 0.10)' : 'rgba(124, 58, 237, 0.06)';
    const redColor = isDark ? '#fb7185' : '#e11d48';

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: dataUsd,
          borderColor: accentColor,
          borderWidth: 2,
          pointRadius: showPoints ? 4 : 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: accentColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          fill: true,
          backgroundColor: fillColor,
          tension: 0.35,
          segment: {
            borderColor: (ctx) => {
              if (!ctx.p1DataIndex) return undefined;
              const val = dataUsd[ctx.p1DataIndex];
              const peak = peakUsd[ctx.p1DataIndex];
              return val < peak ? redColor : undefined;
            }
          }
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleFont: { family: CHART_FONT, size: 11 },
            bodyFont: { family: CHART_FONT, size: 12, weight: '600' },
            padding: 10,
            cornerRadius: 8,
            callbacks: { label: (ctx) => labelFmt(ctx.raw) },
          },
        },
        scales: {
          x: {
            ticks: { color: '#a1a1aa', font: { size: 10, family: CHART_FONT }, maxTicksLimit: 7, maxRotation: 0 },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            ticks: { color: '#a1a1aa', font: { size: 10, family: CHART_FONT }, callback: labelFmt, maxTicksLimit: 6 },
            grid: { color: 'rgba(0, 0, 0, 0.04)' },
            border: { display: false },
          },
        },
      },
    });
  }, [points, empty, denom, initialDeposit]);

  return (
    <>
      <div className={`${isModal ? 'flex h-full min-h-0 flex-col bg-white dark:bg-zinc-900' : card} overflow-hidden ${fill && !isModal ? 'flex h-full min-h-0 flex-col' : ''}`}>
        <div className={`${cardHd} shrink-0`}>
          <div>
            <h3 className={cardTitle}>Equity curve</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Cumulative performance over time</p>
          </div>
          <div className="flex items-center gap-2">
            {action}
            {!empty && lastVal != null && (
              <span className={`text-sm font-semibold sm:inline ${lastVal >= initialDeposit ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {fmtPnlStrict(lastVal, denom)}
              </span>
            )}
            {!isModal ? (
              <button
                onClick={() => setExpanded(true)}
                className="ml-2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                title="Expand chart"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="ml-2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                title="Close"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className={`${cardBody} relative ${fill ? 'min-h-0 flex-1' : 'h-72 sm:h-80'}`}>
          {empty ? (
            <div className={emptyState}>No trades to chart yet.</div>
          ) : (
            <canvas ref={canvasRef} className="h-full w-full" />
          )}
        </div>
      </div>

      {expanded && !isModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-8">
          <div className="h-full w-full max-w-7xl overflow-hidden rounded-xl shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800">
            <EquityChart
              trades={trades}
              daily={daily}
              denomination={denomination}
              initialDeposit={initialDeposit}
              fill
              isModal
              onClose={() => setExpanded(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
