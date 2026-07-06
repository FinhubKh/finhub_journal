import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { card, cardBody, cardHd, cardTitle, emptyState, pillBtn, pillToggle } from '../../lib/ui';

const CHART_FONT = 'ui-sans-serif, system-ui, sans-serif';

export default function EquityChart({ trades }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [mode, setMode] = useState('usd');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!trades || trades.length === 0) {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      return;
    }

    const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = [];
    const dataUsd = [];
    const dataR = [];
    let cumUsd = 0;
    let cumR = 0;

    sorted.forEach((t) => {
      cumUsd += t.pnl_usd || 0;
      cumR += t.r_value || 0;
      labels.push(new Date(`${t.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      dataUsd.push(parseFloat(cumUsd.toFixed(2)));
      dataR.push(parseFloat(cumR.toFixed(2)));
    });

    const values = mode === 'usd' ? dataUsd : dataR;
    const accentColor = '#7c3aed';
    const fillColor = 'rgba(124, 58, 237, 0.06)';
    const tickColor = '#a1a1aa';
    const gridColor = 'rgba(0, 0, 0, 0.04)';
    const labelFmt = mode === 'usd'
      ? (v) => (v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`)
      : (v) => (v >= 0 ? `+${v.toFixed(2)}R` : `${v.toFixed(2)}R`);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: accentColor,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: accentColor,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          fill: true,
          backgroundColor: fillColor,
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            ticks: { color: tickColor, font: { size: 10, family: CHART_FONT }, maxTicksLimit: 7, maxRotation: 0 },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            ticks: { color: tickColor, font: { size: 10, family: CHART_FONT }, callback: labelFmt, maxTicksLimit: 6 },
            grid: { color: gridColor },
            border: { display: false },
          },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [trades, mode]);

  const empty = !trades || trades.length === 0;
  const lastVal = empty ? null : (mode === 'usd'
    ? trades.reduce((s, t) => s + (t.pnl_usd || 0), 0)
    : trades.reduce((s, t) => s + (t.r_value || 0), 0));

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardHd}>
        <div>
          <h3 className={cardTitle}>Equity curve</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Cumulative performance over time</p>
        </div>
        <div className="flex items-center gap-2">
          {!empty && lastVal != null && (
            <span className={`hidden text-sm font-semibold sm:inline ${lastVal >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
              {mode === 'usd'
                ? (lastVal >= 0 ? `+$${lastVal.toFixed(2)}` : `-$${Math.abs(lastVal).toFixed(2)}`)
                : `${lastVal >= 0 ? '+' : ''}${lastVal.toFixed(2)}R`}
            </span>
          )}
          <div className={pillToggle}>
            <button className={pillBtn(mode === 'usd')} onClick={() => setMode('usd')} type="button">USD</button>
            <button className={pillBtn(mode === 'r')} onClick={() => setMode('r')} type="button">R</button>
          </div>
        </div>
      </div>
      <div className={`${cardBody} relative h-[240px] sm:h-[280px]`}>
        <canvas ref={canvasRef} className={empty ? 'hidden' : 'block h-full w-full'} />
        {empty && <div className={emptyState}>No trades to chart yet.</div>}
      </div>
    </div>
  );
}
