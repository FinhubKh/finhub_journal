import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { card, cardBody, cardHd, cardTitle, emptyState, pillBtn, pillToggle } from '../../lib/ui';

const CHART_FONT = 'ui-sans-serif, system-ui, sans-serif';

function buildSeries(trades) {
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

  return { labels, dataUsd, dataR };
}

export default function EquityChart({ trades }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [mode, setMode] = useState('usd');

  const empty = !trades || trades.length === 0;

  const lastVal = useMemo(() => {
    if (empty) return null;
    return mode === 'usd'
      ? trades.reduce((s, t) => s + (t.pnl_usd || 0), 0)
      : trades.reduce((s, t) => s + (t.r_value || 0), 0);
  }, [trades, mode, empty]);

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

    const { labels, dataUsd, dataR } = buildSeries(trades);
    const values = mode === 'usd' ? dataUsd : dataR;
    const labelFmt = mode === 'usd'
      ? (v) => (v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`)
      : (v) => (v >= 0 ? `+${v.toFixed(2)}R` : `${v.toFixed(2)}R`);

    if (chartRef.current) {
      const chart = chartRef.current;
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.options.scales.y.ticks.callback = labelFmt;
      chart.options.plugins.tooltip.callbacks.label = (ctx) => labelFmt(ctx.raw);
      chart.update('none');
      return;
    }

    const accentColor = '#7c3aed';
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
          backgroundColor: 'rgba(124, 58, 237, 0.06)',
          tension: 0.35,
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
  }, [trades, mode, empty]);

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
      <div className={`${cardBody} relative h-56`}>
        {empty ? (
          <div className={emptyState}>No trades to chart yet.</div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
    </div>
  );
}
