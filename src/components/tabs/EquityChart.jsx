import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { useAppData } from '../../context/AppDataContext';

export default function EquityChart({ trades }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [mode, setMode] = useState('usd');
  const { dark } = useAppData();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!trades || trades.length === 0) {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      return;
    }

    const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = [], dataUsd = [], dataR = [];
    let cumUsd = 0, cumR = 0;
    sorted.forEach((t) => {
      cumUsd += t.pnl_usd || 0;
      cumR += t.r_value || 0;
      labels.push(new Date(`${t.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      dataUsd.push(parseFloat(cumUsd.toFixed(2)));
      dataR.push(parseFloat(cumR.toFixed(2)));
    });

    const values = mode === 'usd' ? dataUsd : dataR;
    const accentColor = dark ? '#4ade80' : '#5a6e42';
    const fillColor = dark ? 'rgba(74,222,128,0.08)' : 'rgba(90,110,66,0.08)';
    const tickColor = dark ? '#4a4a4a' : '#8a8478';
    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
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
          pointHoverRadius: 4,
          pointHoverBackgroundColor: accentColor,
          fill: true,
          backgroundColor: fillColor,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => labelFmt(ctx.raw) } } },
        scales: {
          x: { ticks: { color: tickColor, font: { size: 9, family: 'DM Mono' }, maxTicksLimit: 8, maxRotation: 0 }, grid: { color: gridColor } },
          y: { ticks: { color: tickColor, font: { size: 9, family: 'DM Mono' }, callback: labelFmt }, grid: { color: gridColor } },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [trades, mode, dark]);

  const empty = !trades || trades.length === 0;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-hd">
        <h3 className="card-title">Equity Curve</h3>
        <div className="dash-chart-toggle">
          <button className={`dash-toggle-btn ${mode === 'usd' ? 'active' : ''}`} onClick={() => setMode('usd')} type="button">$</button>
          <button className={`dash-toggle-btn ${mode === 'r' ? 'active' : ''}`} onClick={() => setMode('r')} type="button">R</button>
        </div>
      </div>
      <div className="stats-chart-wrap">
        <canvas ref={canvasRef} style={{ display: empty ? 'none' : 'block' }} />
        {empty && <div className="chart-empty">No trades yet.</div>}
      </div>
    </div>
  );
}