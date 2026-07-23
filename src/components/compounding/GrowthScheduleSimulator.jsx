import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { btnGhost, btnPrimary, card, cardBody, input, label, select } from '../../lib/ui';

const TIME_BOUNDS = {
  weeks: { min: 1, max: 6240 },
  months: { min: 1, max: 120 },
  years: { min: 1, max: 30 },
};

const pctFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function GrowthScheduleSimulator({ onCreatePlanFromSimulation }) {
  // --- Inputs State ---
  const [capital, setCapital] = useState('10000');
  const [targetReturn, setTargetReturn] = useState('1.5');
  const [frequency, setFrequency] = useState('week'); // 'week' | 'month'
  const [growthType, setGrowthType] = useState('compound'); // 'compound' | 'fixed'
  const [timeHorizon, setTimeHorizon] = useState('52');
  const [timeUnit, setTimeUnit] = useState('weeks'); // 'weeks' | 'months' | 'years'

  const [globalTrades, setGlobalTrades] = useState('10');
  const [globalWinRate, setGlobalWinRate] = useState('40');
  const [globalRR, setGlobalRR] = useState('2.5');

  // Custom risk overrides: key = period number, value = number
  const [customRiskOverrides, setCustomRiskOverrides] = useState({});

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Bounds for current time unit
  const currentBounds = TIME_BOUNDS[timeUnit] || TIME_BOUNDS.weeks;

  // Handle unit change and clamp value
  const handleUnitChange = (newUnit) => {
    setTimeUnit(newUnit);
    const bounds = TIME_BOUNDS[newUnit] || TIME_BOUNDS.weeks;
    const val = Number(timeHorizon) || 1;
    if (val > bounds.max) setTimeHorizon(String(bounds.max));
    if (val < bounds.min) setTimeHorizon(String(bounds.min));
  };

  const adjustTime = (delta) => {
    const curr = Number(timeHorizon) || 1;
    const next = Math.max(currentBounds.min, Math.min(currentBounds.max, curr + delta));
    setTimeHorizon(String(next));
  };

  // --- Core Simulation Calculations ---
  const simulation = useMemo(() => {
    const principal = Math.max(0, Number(capital) || 0);
    const ratePct = Math.max(0, Number(targetReturn) || 0);
    const rateDecimal = ratePct / 100;
    const isCompound = growthType === 'compound';
    const timeVal = Math.max(1, Number(timeHorizon) || 1);

    const tradesPerPeriod = Math.max(1, Number(globalTrades) || 1);
    const winRateFrac = Math.min(1, Math.max(0, (Number(globalWinRate) || 0) / 100));
    const rrRatio = Math.max(0.1, Number(globalRR) || 1);

    // Calculate total periods
    let totalPeriods = timeVal;
    if (timeUnit === 'years') {
      totalPeriods = frequency === 'week' ? timeVal * 52 : timeVal * 12;
    } else if (timeUnit === 'months' && frequency === 'week') {
      totalPeriods = timeVal * 4;
    } else if (timeUnit === 'weeks' && frequency === 'month') {
      totalPeriods = Math.ceil(timeVal / 4);
    }
    if (totalPeriods > 6240) totalPeriods = 6240;

    const edgeMultiplier = tradesPerPeriod * winRateFrac * rrRatio - tradesPerPeriod * (1 - winRateFrac);
    const isValidEdge = edgeMultiplier > 0;

    let currentBalance = principal;
    const rows = [];
    const chartLabels = [];
    const chartData = [];

    // Track risk amount per 10-period block
    let currentBlockRisk = null;

    for (let period = 1; period <= totalPeriods; period++) {
      const startCap = currentBalance;
      const isBlockStart = (period - 1) % 10 === 0;

      if (isBlockStart || currentBlockRisk === null) {
        const baseProfitTarget = isCompound ? startCap * rateDecimal : principal * rateDecimal;
        currentBlockRisk = isValidEdge ? baseProfitTarget / edgeMultiplier : 10;
      }

      let reqRiskAmount;
      const isOverridden = customRiskOverrides[period] !== undefined;

      if (isOverridden) {
        reqRiskAmount = customRiskOverrides[period];
      } else {
        reqRiskAmount = currentBlockRisk;
      }

      const targetProfit = isValidEdge ? reqRiskAmount * edgeMultiplier : 0;
      const targetReturnPct = startCap > 0 ? (targetProfit / startCap) * 100 : 0;

      currentBalance += targetProfit;

      const labelPrefix = frequency === 'week' ? 'Wk' : 'Mo';
      chartLabels.push(`${labelPrefix} ${period}`);
      chartData.push(currentBalance);

      if (period <= 500) {
        rows.push({
          period,
          startCap,
          reqRiskAmount,
          targetProfit,
          targetReturnPct,
          endBalance: currentBalance,
          isOverridden,
        });
      }
    }

    const finalBalance = currentBalance;
    const totalReturnPct = principal > 0 ? ((finalBalance - principal) / principal) * 100 : 0;

    return {
      principal,
      totalPeriods,
      isValidEdge,
      edgeMultiplier,
      rows,
      chartLabels,
      chartData,
      finalBalance,
      totalReturnPct,
    };
  }, [
    capital,
    targetReturn,
    frequency,
    growthType,
    timeHorizon,
    timeUnit,
    globalTrades,
    globalWinRate,
    globalRR,
    customRiskOverrides,
  ]);

  // --- 10-Period Risk Override Cascade ---
  const handleRiskChange = (period, rawVal) => {
    const blockEnd = Math.ceil(period / 10) * 10;
    const parsed = parseFloat(rawVal);

    setCustomRiskOverrides((prev) => {
      const next = { ...prev };
      if (isNaN(parsed) || rawVal === '') {
        for (let i = period; i <= blockEnd; i++) {
          delete next[i];
        }
      } else {
        for (let i = period; i <= blockEnd; i++) {
          next[i] = Math.max(0, parsed);
        }
      }
      return next;
    });
  };

  const clearOverrides = () => setCustomRiskOverrides({});

  // --- Chart Effect ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const primaryColor = isDark ? '#60a5fa' : '#3b82f6';
    const fillColor = isDark ? 'rgba(96, 165, 250, 0.12)' : 'rgba(59, 130, 246, 0.08)';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#9ca3af' : '#6b7280';

    if (chartRef.current) {
      const chart = chartRef.current;
      chart.data.labels = simulation.chartLabels;
      chart.data.datasets[0].data = simulation.chartData;
      chart.data.datasets[0].borderColor = primaryColor;
      chart.data.datasets[0].backgroundColor = fillColor;
      chart.options.scales.x.ticks.color = textColor;
      chart.options.scales.x.grid.color = gridColor;
      chart.options.scales.y.ticks.color = textColor;
      chart.options.scales.y.grid.color = gridColor;
      chart.update('none');
      return;
    }

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: simulation.chartLabels,
        datasets: [
          {
            label: 'Account Balance',
            data: simulation.chartData,
            borderColor: primaryColor,
            backgroundColor: fillColor,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: isDark ? '#4ade80' : '#10b981',
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            titleColor: isDark ? '#94a3b8' : '#475569',
            bodyColor: isDark ? '#f8fafc' : '#0f172a',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => `Balance: ${formatMoney(context.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, maxTicksLimit: 10 },
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              callback: (val) => {
                if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
                if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
                return `$${val}`;
              },
            },
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
  }, [simulation]);

  const hasOverrides = Object.keys(customRiskOverrides).length > 0;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Trading Growth Schedule & Edge Simulator
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Model compounding scenarios based on win rate, reward/risk ratios, time horizon, and cascading risk schedules.
          </p>
        </div>
        {onCreatePlanFromSimulation && (
          <button
            type="button"
            className={btnPrimary}
            onClick={() =>
              onCreatePlanFromSimulation({
                startingBalance: simulation.principal,
                targetBalance: Math.min(999999999999, simulation.finalBalance),
                targetProfitPercent: Number(targetReturn) || 1.5,
                riskPercent: 1.0,
              })
            }
          >
            Save as plan
          </button>
        )}
      </div>

      {/* Main Grid: Parameters on Left, HUD & Chart on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Parameters */}
        <div className="space-y-6 lg:col-span-1">
          {/* Account Parameters Card */}
          <div className={`${card} ${cardBody} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Account Parameters</h3>
            </div>

            <div>
              <label className={label}>Starting Capital ($)</label>
              <input
                type="number"
                min="1"
                step="100"
                className={`${input} tabular-nums`}
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className={label}>Target Return per Period</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{targetReturn}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="20"
                step="0.1"
                className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer"
                value={targetReturn}
                onChange={(e) => setTargetReturn(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Frequency</label>
                <select className={select} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="week">Per Week</option>
                  <option value="month">Per Month</option>
                </select>
              </div>
              <div>
                <label className={label}>Growth Type</label>
                <select className={select} value={growthType} onChange={(e) => setGrowthType(e.target.value)}>
                  <option value="compound">Compound</option>
                  <option value="fixed">Fixed (Simple)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className={label}>Time Horizon</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {timeHorizon} {timeUnit}
                </span>
              </div>
              <input
                type="range"
                min={currentBounds.min}
                max={currentBounds.max}
                step="1"
                className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer"
                value={timeHorizon}
                onChange={(e) => setTimeHorizon(e.target.value)}
              />

              {/* Fine tuning controls */}
              <div className="mt-2.5 flex items-center justify-between gap-1.5">
                <div className="flex gap-1">
                  <button type="button" className={`${btnGhost} !px-2 !py-1 !text-xs font-mono`} onClick={() => adjustTime(-10)}>
                    -10
                  </button>
                  <button type="button" className={`${btnGhost} !px-2 !py-1 !text-xs font-mono`} onClick={() => adjustTime(-1)}>
                    -1
                  </button>
                </div>
                <select
                  className={`${select} !w-auto !py-1 !text-xs`}
                  value={timeUnit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                >
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
                <div className="flex gap-1">
                  <button type="button" className={`${btnGhost} !px-2 !py-1 !text-xs font-mono`} onClick={() => adjustTime(1)}>
                    +1
                  </button>
                  <button type="button" className={`${btnGhost} !px-2 !py-1 !text-xs font-mono`} onClick={() => adjustTime(10)}>
                    +10
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy & Risk Edge Card */}
          <div className={`${card} ${cardBody} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Global Strategy Edge</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Trades / Period</label>
                <input
                  type="number"
                  min="1"
                  className={`${input} tabular-nums`}
                  value={globalTrades}
                  onChange={(e) => setGlobalTrades(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Win Rate %</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className={`${input} tabular-nums`}
                  value={globalWinRate}
                  onChange={(e) => setGlobalWinRate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={label}>Avg Reward / Risk (RR)</label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-400">1 :</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className={`${input} tabular-nums`}
                  value={globalRR}
                  onChange={(e) => setGlobalRR(e.target.value)}
                />
              </div>
            </div>

            {/* Calculated Strategy Edge & Required Risk Feedback */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Net Edge / Period:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {simulation.isValidEdge ? `+${simulation.edgeMultiplier.toFixed(2)}R` : 'Invalid Edge'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-emerald-500/10 pt-2">
                <span className="text-zinc-500 dark:text-zinc-400">Required Risk / Trade:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {simulation.isValidEdge && simulation.rows.length > 0
                    ? `${formatMoney(simulation.rows[0].reqRiskAmount)} (${(
                        (simulation.rows[0].reqRiskAmount / simulation.principal) *
                        100
                      ).toFixed(2)}%)`
                    : '--'}
                </span>
              </div>
            </div>

            {!simulation.isValidEdge && (
              <div className="rounded-lg bg-rose-500/10 p-2.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                Warning: Current Win Rate and RR result in a negative or zero strategy edge.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Summary HUD & Chart */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Summary HUD */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`${card} ${cardBody} text-center`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Final Balance
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatMoney(simulation.finalBalance)}
              </p>
            </div>
            <div className={`${card} ${cardBody} text-center`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Total Return
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                +{pctFormatter.format(simulation.totalReturnPct)}%
              </p>
            </div>
          </div>

          {/* Growth Curve Chart */}
          <div className={`${card} ${cardBody} flex flex-1 flex-col min-h-[320px]`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Growth Curve Projection
              </h3>
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                {simulation.totalPeriods} periods
              </span>
            </div>
            <div className="relative w-full flex-1 min-h-[260px]">
              <canvas ref={canvasRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Growth Schedule Table */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <svg className="h-5 w-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Detailed Growth Schedule
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              * Modifying a Risk ($) applies it through the end of its 10-period block.
            </p>
          </div>

          {hasOverrides && (
            <button type="button" className={`${btnGhost} !py-1.5 !text-xs text-amber-600 dark:text-amber-400`} onClick={clearOverrides}>
              Reset Risk Overrides
            </button>
          )}
        </div>

        <div className="max-h-[550px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 shadow-sm z-10 text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Period</th>
                <th className="px-6 py-3.5 font-semibold">Start Cap</th>
                <th className="px-6 py-3.5 font-semibold text-center">Req. Risk per Trade ($)</th>
                <th className="px-6 py-3.5 font-semibold text-right">Target Profit</th>
                <th className="px-6 py-3.5 font-semibold text-right">Target Return %</th>
                <th className="px-6 py-3.5 font-semibold text-right">End Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono text-zinc-800 dark:text-zinc-200">
              {simulation.rows.map((row) => (
                <tr key={row.period} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">{row.period}</td>
                  <td className="px-6 py-3">{formatMoney(row.startCap)}</td>
                  <td className="px-6 py-3">
                    {simulation.isValidEdge ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs text-zinc-400">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className={`w-28 rounded border px-2 py-1 text-right text-xs font-mono transition-colors focus:outline-none focus:border-blue-500 ${
                            row.isOverridden
                              ? 'border-amber-500/80 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                          }`}
                          value={row.reqRiskAmount < 1 ? row.reqRiskAmount.toFixed(4) : row.reqRiskAmount.toFixed(2)}
                          onChange={(e) => handleRiskChange(row.period, e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-rose-500">Invalid Edge</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                    +{formatMoney(row.targetProfit)}
                  </td>
                  <td className="px-6 py-3 text-right text-zinc-500 dark:text-zinc-400">
                    {pctFormatter.format(row.targetReturnPct)}%
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                    {formatMoney(row.endBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
