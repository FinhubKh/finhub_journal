import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { buildPerfGroups } from '../../lib/stats';
import { fmtPnlStrict } from '../../lib/format';
import { card, cardBody, cardHd, cardTitle, emptyState, pillBtn, pillToggle } from '../../lib/ui';

const LIGHT_PIE_COLORS = ['#7c3aed', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff'];
const DARK_PIE_COLORS = ['#4ade80', '#22d3ee', '#60a5fa', '#a78bfa', '#fbbf24', '#fb923c', '#f472b6', '#5eead4'];
const KINDS = [
  { id: 'symbol', label: 'Pair' },
  { id: 'model', label: 'Model' },
  { id: 'session', label: 'Session' },
];

const CHART_FONT = 'ui-sans-serif, system-ui, sans-serif';

export default function BreakdownCard({ trades, denomination = 'usd', fill = false }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [kind, setKind] = useState('symbol');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const totals = {};
    trades.forEach((t) => {
      const k = t[kind] ? t[kind].charAt(0).toUpperCase() + t[kind].slice(1) : 'Other';
      totals[k] = (totals[k] || 0) + 1;
    });
    const labels = Object.keys(totals);
    const data = Object.values(totals);

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (labels.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const pieColors = isDark ? DARK_PIE_COLORS : LIGHT_PIE_COLORS;

    chartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: pieColors.slice(0, labels.length),
          borderColor: isDark ? '#161616' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#71717a',
              font: { size: 10, family: CHART_FONT },
              boxWidth: 8,
              padding: 10,
              usePointStyle: true,
            },
          },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [trades, kind]);

  const groups = trades.length === 0 ? null : buildPerfGroups(trades, kind);
  const entries = groups ? Object.entries(groups).sort((a, b) => b[1].pnl - a[1].pnl) : [];

  return (
    <div className={`${card} overflow-hidden ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className={`${cardHd} shrink-0`}>
        <div>
          <h3 className={cardTitle}>Breakdown</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Performance by dimension</p>
        </div>
        <div className={pillToggle}>
          {KINDS.map((k) => (
            <button key={k.id} className={pillBtn(kind === k.id)} onClick={() => setKind(k.id)} type="button">
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${cardBody} relative ${fill ? 'min-h-[200px] flex-[1.1]' : 'h-[180px]'}`}>
        {trades.length === 0 ? (
          <div className={emptyState}>No breakdown data yet.</div>
        ) : (
          <canvas ref={canvasRef} className="h-full w-full" />
        )}
      </div>

      {entries.length > 0 && (
        <div
          className={`border-t border-zinc-100 dark:border-zinc-800 ${
            fill ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[220px] overflow-y-auto'
          }`}
        >
          {entries.map(([name, d]) => {
            const t = d.wins + d.losses + d.be;
            const wr = t > 0 ? Math.round((d.wins / t) * 100) : 0;
            return (
              <div
                className="flex items-center justify-between gap-3 border-b border-zinc-50 px-4 py-3 last:border-0 dark:border-zinc-900 md:px-5"
                key={name}
              >
                <div className="min-w-0 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{name}</div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {wr}% WR
                  </span>
                  <span className={`font-semibold tabular-nums ${d.pnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {fmtPnlStrict(d.pnl, denomination)}
                  </span>
                  <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{t}t</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
