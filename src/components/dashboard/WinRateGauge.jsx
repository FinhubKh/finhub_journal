import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { card, cardBody, cardHd, cardTitle } from '../../lib/ui';

export default function WinRateGauge({ wins, losses }) {
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
        maintainAspectRatio: false,
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
    <div className={`${card} flex h-full flex-col`}>
      <div className={cardHd}>
        <div className="flex w-full items-center justify-between">
          <h2 className={cardTitle}>Win rate (all time)</h2>
          <button className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" aria-label="Help">?</button>
        </div>
      </div>
      <div className={`${cardBody} flex min-h-0 flex-1 flex-col items-center justify-center py-8`}>
        <div className="relative flex w-full max-w-[260px] flex-col items-center justify-center">
          <div className="relative w-full aspect-[2/1]">
             <canvas ref={canvasRef} />
             <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-1">
               <span className="text-4xl font-bold text-zinc-900 dark:text-white">{winRate}%</span>
             </div>
          </div>
          <div className="mt-4 text-sm text-zinc-500">
            {wins || 0} win{wins !== 1 ? 's' : ''} &middot; {losses || 0} loss{losses !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
