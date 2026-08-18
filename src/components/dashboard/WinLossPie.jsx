import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { card, cardBody, cardHd, cardTitle } from '../../lib/ui';

const CHART_FONT = 'ui-sans-serif, system-ui, sans-serif';

export default function WinLossPie({ wins, losses, beCount }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgColors = ['#10b981', '#f43f5e', '#f59e0b']; // emerald, rose, amber
    
    const dataVals = [wins || 0, losses || 0, beCount || 0];
    if (dataVals.every(v => v === 0)) return;

    chartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses', 'Break-even'],
        datasets: [{
          data: dataVals,
          backgroundColor: bgColors,
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
          tooltip: {
            backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
            titleColor: isDark ? '#e4e4e7' : '#18181b',
            bodyColor: isDark ? '#a1a1aa' : '#52525b',
            borderColor: isDark ? '#27272a' : '#e4e4e7',
            borderWidth: 1,
            padding: 8,
            boxPadding: 4,
            usePointStyle: true,
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
  }, [wins, losses, beCount]);

  return (
    <div className={`${card} flex h-full flex-col`}>
      <div className={cardHd}>
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Wins vs losses</p>
          <h2 className={cardTitle}>Trade breakdown</h2>
        </div>
      </div>
      <div className={`${cardBody} flex min-h-0 flex-1 flex-col items-center justify-center p-3 sm:p-4`}>
        {(!wins && !losses && !beCount) ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500 md:px-5">No trades yet.</div>
        ) : (
          <div className="relative flex h-full w-full min-h-[220px] flex-col items-center justify-center">
            <canvas ref={canvasRef} />
          </div>
        )}
      </div>
    </div>
  );
}
