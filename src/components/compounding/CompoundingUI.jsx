import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import {
  btnGhost,
  btnPrimary,
  card,
  cardBody,
  cardHd,
  cardTitle,
  emptyState,
  sectionLabel,
} from '../../lib/ui';

/** Align with Overview StatTile: positive = violet, negative = rose */
export function toneValueClass(tone) {
  if (tone === 'profit' || tone === 'positive') return 'text-violet-600';
  if (tone === 'loss' || tone === 'negative') return 'text-rose-600';
  return 'text-zinc-900';
}

export function pnlToneClass(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return 'text-zinc-500';
  if (Number(amount) > 0) return 'text-violet-600';
  if (Number(amount) < 0) return 'text-rose-600';
  return 'text-zinc-500';
}

export function MetricCard({ label, value, hint, tone = 'neutral', size = 'md', className = '' }) {
  const valueSize = size === 'sm' ? 'text-base font-semibold' : 'text-lg font-semibold sm:text-xl';
  return (
    <div className={`${card} flex flex-col justify-between p-4 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      <div className={`mt-2 tabular-nums tracking-tight ${valueSize} ${toneValueClass(tone)}`}>{value}</div>
      {hint ? <span className="mt-1 text-xs text-zinc-500">{hint}</span> : null}
    </div>
  );
}

export function PreviewStat({ label, value, tone = 'neutral' }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${toneValueClass(tone)}`}>{value}</div>
    </div>
  );
}

export function StatusBadge({ status }) {
  if (status === 'completed') {
    return (
      <span className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-300">
        Done
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        Next
      </span>
    );
  }
  return (
    <span className="rounded-md border border-zinc-100 dark:border-zinc-800 px-2 py-0.5 text-xs text-zinc-400 dark:text-zinc-500">Pending</span>
  );
}

export function DistributionChip({ name, value, color }) {
  return (
    <div
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="text-zinc-500 dark:text-zinc-400">{name}</div>
      <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

export function SectionBlock({ title, children, className = '' }) {
  return (
    <div className={className}>
      {title ? <h2 className={`${sectionLabel} mb-3`}>{title}</h2> : null}
      {children}
    </div>
  );
}

export function PlanModalShell({ title, subtitle, children, footer, onClose, busy }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!busy) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compounding-modal-title"
        className={`${card} w-full max-w-lg shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 id="compounding-modal-title" className="text-base font-semibold text-zinc-900">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-xs text-zinc-500">{subtitle}</p> : null}
        </div>
        <div className="space-y-3 px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function ModalActions({ onCancel, onConfirm, busy, confirmLabel, cancelLabel = 'Cancel' }) {
  return (
    <>
      <button type="button" className={btnGhost} onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </button>
      <button type="button" className={btnPrimary} onClick={onConfirm} disabled={busy}>
        {busy ? 'Saving…' : confirmLabel}
      </button>
    </>
  );
}

const CHART_FONT = 'ui-sans-serif, system-ui, sans-serif';

function formatMoneyTick(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

/** Stable Chart.js line card — updates in place instead of destroy/recreate when possible */
export function LineChartCard({ title, labels, values, color, emptyMessage }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const colorRef = useRef(color);
  colorRef.current = color;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    if (!labels?.length) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return undefined;
    }

    if (chartRef.current) {
      const chart = chartRef.current;
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].borderColor = colorRef.current;
      chart.data.datasets[0].backgroundColor = `${colorRef.current}14`;
      chart.update('none');
      return undefined;
    }

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: colorRef.current,
            borderWidth: 2,
            pointRadius: 2,
            fill: true,
            backgroundColor: `${colorRef.current}14`,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleFont: { family: CHART_FONT, size: 11 },
            bodyFont: { family: CHART_FONT, size: 12, weight: '600' },
            padding: 10,
            cornerRadius: 8,
            callbacks: { label: (ctx) => formatMoneyTick(ctx.raw) },
          },
        },
        scales: {
          x: {
            ticks: { color: '#a1a1aa', maxRotation: 0, font: { family: CHART_FONT, size: 11 } },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: '#a1a1aa',
              font: { family: CHART_FONT, size: 11 },
              callback: (v) => formatMoneyTick(v),
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });

    return undefined;
  }, [labels, values]);

  useEffect(
    () => () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    },
    [],
  );

  return (
    <div className={card}>
      <div className={cardHd}>
        <h3 className={cardTitle}>{title}</h3>
      </div>
      <div className={`${cardBody} h-56`}>
        {!labels?.length ? <div className={emptyState}>{emptyMessage}</div> : <canvas ref={canvasRef} />}
      </div>
    </div>
  );
}

export function PanelCard({ title, children, className = '', bodyClassName = '' }) {
  return (
    <div className={`${card} ${className}`}>
      {title ? (
        <div className={cardHd}>
          <h2 className={cardTitle}>{title}</h2>
        </div>
      ) : null}
      <div className={`${cardBody} ${bodyClassName}`}>{children}</div>
    </div>
  );
}
