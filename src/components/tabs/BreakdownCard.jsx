import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { useAppData } from '../../context/AppDataContext';
import { buildPerfGroups } from '../../lib/stats';

function fmtPnlStrict(v) {
  return v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
}

const PIE_COLORS = ['#7a9260', '#3a5e7a', '#9a7e3e', '#5a3e7a', '#9a5e5e', '#2a6e6e', '#465666', '#6a4a2a'];
const KINDS = ['symbol', 'model', 'session'];

export default function BreakdownCard({ trades }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [kind, setKind] = useState('symbol');
  const { dark } = useAppData();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const totals = {};
    trades.forEach((t) => {
      const k = t[kind] ? t[kind].charAt(0).toUpperCase() + t[kind].slice(1) : 'Other';
      totals[k] = (totals[k] || 0) + 1;
    });
    const labels = Object.keys(totals), data = Object.values(totals);
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (labels.length === 0) return;
    chartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: PIE_COLORS, borderColor: dark ? '#111' : '#fff', borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { color: dark ? '#aaa' : '#5c6370', font: { size: 9, family: 'DM Mono' }, boxWidth: 8, padding: 8 } } },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [trades, kind, dark]);

  const groups = trades.length === 0 ? null : buildPerfGroups(trades, kind);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-hd">
        <h3 className="card-title">Breakdown</h3>
        <div className="ov-pills">
          {KINDS.map((k) => (
            <button key={k} className={`ov-pill ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)} type="button">
              {k === 'model' ? 'Model' : k === 'session' ? 'Session' : 'Pair'}
            </button>
          ))}
        </div>
      </div>
      <div className="ov-pie-wrap"><canvas ref={canvasRef} /></div>
      {!groups ? (
        <div className="empty-state">No trades yet.</div>
      ) : (
        <div>
          {Object.entries(groups).map(([name, d]) => {
            const t = d.wins + d.losses + d.be;
            const w = t > 0 ? Math.round((d.wins / t) * 100) : 0;
            return (
              <div className="perf-row" key={name}>
                <div className="perf-name">{name}</div>
                <div className="perf-meta">
                  <span className="perf-wr">{w}% WR</span>
                  <span className={`perf-r ${d.pnl >= 0 ? 'win-col' : 'loss-col'}`}>{fmtPnlStrict(d.pnl)}</span>
                  <span className="perf-count">{t} trades</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}