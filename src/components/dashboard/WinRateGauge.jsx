import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { card, cardBody, cardHd, cardTitle } from '../../lib/ui';

export default function WinRateGauge({ wins, losses, fill = false }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const total = (wins || 0) + (losses || 0);
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    const color = '#10b981'; // emerald-500
    const emptyColor = isDark ? '#27272a' : '#f4f4f5'; // zinc-800 or zinc-100

    chartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses'],
        datasets: [{
          data: total > 0 ? [winRate, 100 - winRate] : [0, 100],
          backgroundColor: [color, emptyColor],
          borderWidth: 0,
          borderRadius: 40,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        cutout: '80%',
        circumference: 180,
        rotation: -90,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [winRate, total]);

  return (
    <div className={`${card} flex h-full min-h-0 flex-col`}>
      <div className={`${cardHd} shrink-0`}>
        <div>
          <h2 className={cardTitle}>Win rate</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Closed trades only</p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
          {wins || 0}W · {losses || 0}L
        </span>
      </div>
      <div className={`${cardBody} flex min-h-0 flex-1 flex-col items-center justify-center ${fill ? 'py-3' : 'py-8'}`}>
        <div className="relative flex w-full max-w-[240px] flex-col items-center justify-center">
          <canvas ref={canvasRef} />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-1 sm:pb-2">
            <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-white sm:text-4xl">{winRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
