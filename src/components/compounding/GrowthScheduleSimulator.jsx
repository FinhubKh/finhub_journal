import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { btnDanger, btnGhost, btnPrimary, btnSecondary, card, cardBody, input, label, select } from '../../lib/ui';

const PRESETS = {
  spreadsheet: {
    name: 'Spreadsheet Loss-Buffer Plan (10 → 40 Losses Buffer)',
    capital: '100',
    timeHorizon: '20',
    timeUnit: 'weeks',
    tiers: [
      { id: '1', from: 1, to: 4, lossCushion: 10, rr: 6 },
      { id: '2', from: 5, to: 8, lossCushion: 20, rr: 6 },
      { id: '3', from: 9, to: 12, lossCushion: 30, rr: 6 },
      { id: '4', from: 13, to: 20, lossCushion: 40, rr: 6 },
    ],
  },
  conservativeBuffer: {
    name: 'Conservative Buffer (20 → 50 Losses Buffer)',
    capital: '1000',
    timeHorizon: '52',
    timeUnit: 'weeks',
    tiers: [
      { id: '1', from: 1, to: 12, lossCushion: 20, rr: 3 },
      { id: '2', from: 13, to: 26, lossCushion: 30, rr: 3 },
      { id: '3', from: 27, to: 52, lossCushion: 50, rr: 3 },
    ],
  },
  ultraConservative: {
    name: 'Ultra Conservative (50 → 100 Losses Buffer)',
    capital: '10000',
    timeHorizon: '52',
    timeUnit: 'weeks',
    tiers: [
      { id: '1', from: 1, to: 12, lossCushion: 50, rr: 2.5 },
      { id: '2', from: 13, to: 26, lossCushion: 75, rr: 2.5 },
      { id: '3', from: 27, to: 52, lossCushion: 100, rr: 2.5 },
    ],
  },
};

const pctFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function GrowthScheduleSimulator({ onCreatePlanFromSimulation }) {
  // --- Inputs State ---
  const [capital, setCapital] = useState(PRESETS.spreadsheet.capital);
  const [timeHorizon, setTimeHorizon] = useState(PRESETS.spreadsheet.timeHorizon);
  const [timeUnit, setTimeUnit] = useState(PRESETS.spreadsheet.timeUnit);
  const [frequency, setFrequency] = useState('week'); // 'week' | 'month'

  // Risk Tiers Array (lossCushion = max consecutive losses to blow account)
  const [tiers, setTiers] = useState(PRESETS.spreadsheet.tiers);

  // Custom risk overrides: key = period number, value = number
  const [customRiskOverrides, setCustomRiskOverrides] = useState({});

  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Load Preset
  const applyPreset = (presetKey) => {
    const p = PRESETS[presetKey];
    if (!p) return;
    setCapital(p.capital);
    setTimeHorizon(p.timeHorizon);
    setTimeUnit(p.timeUnit);
    setTiers(p.tiers.map((t) => ({ ...t })));
    setCustomRiskOverrides({});
  };

  // Tier Management
  const updateTier = (id, field, value) => {
    setTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: Number(value) } : t))
    );
  };

  const addTier = () => {
    setTiers((prev) => {
      const last = prev[prev.length - 1];
      const newFrom = last ? last.to + 1 : 1;
      const newTo = newFrom + 3;
      return [
        ...prev,
        {
          id: String(Date.now()),
          from: newFrom,
          to: newTo,
          lossCushion: last ? last.lossCushion + 10 : 20,
          rr: last ? last.rr : 3,
        },
      ];
    });
  };

  const removeTier = (id) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Core Simulation Calculations ---
  const simulation = useMemo(() => {
    const principal = Math.max(0, Number(capital) || 0);
    const totalPeriods = Math.max(1, Number(timeHorizon) || 1);

    let currentBalance = principal;
    const rows = [];
    const chartLabels = [];
    const chartData = [];

    const sortedTiers = [...tiers].sort((a, b) => a.from - b.from);

    for (let period = 1; period <= totalPeriods; period++) {
      const startCap = currentBalance;

      // Find active tier
      let activeTier = sortedTiers.find((t) => period >= t.from && period <= t.to);
      if (!activeTier && sortedTiers.length > 0) {
        if (period < sortedTiers[0].from) activeTier = sortedTiers[0];
        else activeTier = sortedTiers[sortedTiers.length - 1];
      }

      const lossCushion = Math.max(1, activeTier ? activeTier.lossCushion : 10);
      const rrRatio = Math.max(0.1, activeTier ? activeTier.rr : 2.5);

      // Risk per trade = Start Cap / Loss Cushion (e.g. $100 / 10 = $10 per trade)
      let riskPerTrade = startCap / lossCushion;

      const isOverridden = customRiskOverrides[period] !== undefined;
      if (isOverridden) {
        riskPerTrade = customRiskOverrides[period];
      }

      // Profit per win trade = Risk per trade * RR
      const targetProfit = riskPerTrade * rrRatio;
      const riskPercent = startCap > 0 ? (riskPerTrade / startCap) * 100 : 0;
      const targetReturnPct = startCap > 0 ? (targetProfit / startCap) * 100 : 0;

      currentBalance += targetProfit;

      const labelPrefix = frequency === 'week' ? 'Wk' : 'Mo';
      chartLabels.push(`${labelPrefix} ${period}`);
      chartData.push(currentBalance);

      if (period <= 500) {
        rows.push({
          period,
          startCap,
          activeTier,
          lossCushion,
          rrRatio,
          riskPerTrade,
          riskPercent,
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
      rows,
      chartLabels,
      chartData,
      finalBalance,
      totalReturnPct,
    };
  }, [
    capital,
    timeHorizon,
    frequency,
    tiers,
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
                if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
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
            Risk De-escalation Simulator
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Risk = Capital / Loss Buffer. Scale up your loss cushion as capital grows to protect your account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onCreatePlanFromSimulation && (
            <button
              type="button"
              className={btnPrimary}
              onClick={() =>
                onCreatePlanFromSimulation({
                  startingBalance: simulation.principal,
                  targetBalance: Math.min(999999999999, simulation.finalBalance),
                  targetProfitPercent: simulation.rows[0]?.targetReturnPct || 60,
                  riskPercent: simulation.rows[0]?.riskPercent || 10,
                })
              }
            >
              Save as plan
            </button>
          )}
        </div>
      </div>

      {/* Preset Selector Buttons */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mr-2">Presets:</span>
        <button
          type="button"
          className={`${btnSecondary} !py-1.5 !px-3 !text-xs font-medium`}
          onClick={() => applyPreset('spreadsheet')}
        >
          Spreadsheet Loss Buffer (10 → 40 Losses)
        </button>
        <button
          type="button"
          className={`${btnGhost} !py-1.5 !px-3 !text-xs font-medium`}
          onClick={() => applyPreset('conservativeBuffer')}
        >
          Conservative Buffer (20 → 50 Losses)
        </button>
        <button
          type="button"
          className={`${btnGhost} !py-1.5 !px-3 !text-xs font-medium`}
          onClick={() => applyPreset('ultraConservative')}
        >
          Ultra Conservative (50 → 100 Losses)
        </button>
      </div>

      {/* Top Grid: Global Parameters & HUD */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Account Parameters Card */}
        <div className={`${card} ${cardBody} space-y-4 lg:col-span-1`}>
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
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Global Parameters</h3>
          </div>

          <div>
            <label className={label}>Starting Capital ($)</label>
            <input
              type="number"
              min="1"
              step="10"
              className={`${input} tabular-nums`}
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Frequency</label>
            <select className={select} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="week">Per Week</option>
              <option value="month">Per Month</option>
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className={label}>Time Horizon</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="520"
                  className="w-20 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-0.5 text-right text-xs font-mono font-bold text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500"
                  value={timeHorizon}
                  onChange={(e) => setTimeHorizon(e.target.value)}
                />
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {frequency === 'week' ? 'weeks' : 'months'}
                </span>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="104"
              step="1"
              className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer"
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(e.target.value)}
            />

            {/* Fine tuning controls */}
            <div className="mt-2.5 flex items-center justify-between gap-1.5">
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`${btnGhost} !px-2 !py-1 !text-xs font-mono`}
                  onClick={() => setTimeHorizon(String(Math.max(1, (Number(timeHorizon) || 1) - 10)))}
                >
                  -10
                </button>
                <button
                  type="button"
                  className={`${btnGhost} !px-2 !py-1 !text-xs font-mono`}
                  onClick={() => setTimeHorizon(String(Math.max(1, (Number(timeHorizon) || 1) - 1)))}
                >
                  -1
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`${btnGhost} !px-2 !py-1 !text-xs font-mono`}
                  onClick={() => setTimeHorizon(String(Math.min(520, (Number(timeHorizon) || 1) + 1)))}
                >
                  +1
                </button>
                <button
                  type="button"
                  className={`${btnGhost} !px-2 !py-1 !text-xs font-mono`}
                  onClick={() => setTimeHorizon(String(Math.min(520, (Number(timeHorizon) || 1) + 10)))}
                >
                  +10
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: HUD & Growth Chart */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Summary HUD */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`${card} ${cardBody} text-center`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Final Balance (Wk {timeHorizon})
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
          <div className={`${card} ${cardBody} flex flex-1 flex-col min-h-[300px]`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Loss-Buffer Growth Trajectory
              </h3>
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                {simulation.totalPeriods} weeks
              </span>
            </div>
            <div className="relative w-full flex-1 min-h-[240px]">
              <canvas ref={canvasRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Tiered Risk Schedule Configuration Card */}
      <div className={`${card} ${cardBody} space-y-4`}>
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Loss Cushion Tiers (Consecutive Losses to Blow Capital)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Max consecutive losing trades to blow account
              </p>
            </div>
          </div>
          <button type="button" className={`${btnSecondary} !py-1.5 !px-3 !text-xs`} onClick={addTier}>
            + Add Stage Tier
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="pb-2 font-semibold">Stage</th>
                <th className="pb-2 font-semibold">From {frequency === 'week' ? 'Wk' : 'Mo'}</th>
                <th className="pb-2 font-semibold">To {frequency === 'week' ? 'Wk' : 'Mo'}</th>
                <th className="pb-2 font-semibold text-right">Loss Cushion (Losses to Blow)</th>
                <th className="pb-2 font-semibold text-right">Risk % / Trade</th>
                <th className="pb-2 font-semibold text-right">RR Ratio</th>
                <th className="pb-2 font-semibold text-right">Target Return % / Win</th>
                <th className="pb-2 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
              {tiers.map((t, idx) => {
                const calculatedRiskPct = t.lossCushion > 0 ? 100 / t.lossCushion : 0;
                const calculatedReturnPct = calculatedRiskPct * t.rr;

                return (
                  <tr key={t.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                    <td className="py-2.5 font-medium text-violet-600 dark:text-violet-400">
                      Stage {idx + 1}
                    </td>
                    <td className="py-2.5">
                      <input
                        type="number"
                        min="1"
                        className="w-16 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-center text-xs"
                        value={t.from}
                        onChange={(e) => updateTier(t.id, 'from', e.target.value)}
                      />
                    </td>
                    <td className="py-2.5">
                      <input
                        type="number"
                        min="1"
                        className="w-16 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-center text-xs"
                        value={t.to}
                        onChange={(e) => updateTier(t.id, 'to', e.target.value)}
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <input
                        type="number"
                        min="1"
                        className="w-24 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-right text-xs text-blue-600 dark:text-blue-400 font-bold"
                        value={t.lossCushion}
                        onChange={(e) => updateTier(t.id, 'lossCushion', e.target.value)}
                      />
                    </td>
                    <td className="py-2.5 text-right text-xs text-zinc-500 dark:text-zinc-400">
                      {calculatedRiskPct.toFixed(2)}%
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-xs text-zinc-400">1:</span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          className="w-16 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-right text-xs"
                          value={t.rr}
                          onChange={(e) => updateTier(t.id, 'rr', e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      {calculatedReturnPct.toFixed(2)}%
                    </td>
                    <td className="py-2.5 text-center">
                      {tiers.length > 1 && (
                        <button
                          type="button"
                          className={`${btnDanger} !py-1 !px-2 !text-[11px]`}
                          onClick={() => removeTier(t.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              Risk Management Made Easy
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
                <th className="px-6 py-3.5 font-semibold">{frequency === 'week' ? 'Week' : 'Month'}</th>
                <th className="px-6 py-3.5 font-semibold">Start Cap</th>
                <th className="px-6 py-3.5 font-semibold text-center">Loss Cushion</th>
                <th className="px-6 py-3.5 font-semibold text-center">Risk / Trade ($)</th>
                <th className="px-6 py-3.5 font-semibold text-center">RR</th>
                <th className="px-6 py-3.5 font-semibold text-right">Target Profit</th>
                <th className="px-6 py-3.5 font-semibold text-right">Target Return %</th>
                <th className="px-6 py-3.5 font-semibold text-right">End Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono text-zinc-800 dark:text-zinc-200">
              {simulation.rows.map((row) => (
                <tr key={row.period} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    {row.period}
                  </td>
                  <td className="px-6 py-3">{formatMoney(row.startCap)}</td>
                  <td className="px-6 py-3 text-center text-zinc-500 dark:text-zinc-400">
                    {row.lossCushion}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-zinc-400">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className={`w-28 rounded border px-2 py-1 text-right text-xs font-mono transition-colors focus:outline-none focus:border-blue-500 ${row.isOverridden
                            ? 'border-amber-500/80 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                            : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                          }`}
                        value={row.riskPerTrade < 1 ? row.riskPerTrade.toFixed(4) : row.riskPerTrade.toFixed(2)}
                        onChange={(e) => handleRiskChange(row.period, e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-3 text-center text-zinc-500 dark:text-zinc-400">
                    {row.rrRatio}
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
              {/* Bottom spacer row so final row is fully visible */}
              <tr className="border-none bg-transparent">
                <td colSpan={8} className="py-6 text-center text-xs text-zinc-400 font-medium select-none">
                  End of schedule simulation
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
