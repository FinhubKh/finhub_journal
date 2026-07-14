import { useEffect, useRef, useState } from 'react';
import { computeTradePreview, getCurrentBalance } from '../../lib/compounding/calculations';
import { LOT_SIZE_METHODS } from '../../lib/compounding/types';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { downloadCsv, exportTradesToCsv, exportTradesToPdf } from '../../lib/compounding/export';
import { btnGhost, btnOutline, card, cardBody, input, label } from '../../lib/ui';
import CustomDropdown from '../common/CustomDropdown';

function configSnapshot(config) {
  return JSON.stringify({
    startingBalance: Number(config.startingBalance),
    targetBalance: Number(config.targetBalance),
    targetProfitPercent: Number(config.targetProfitPercent),
    riskPercent: Number(config.riskPercent),
    riskRewardRatio: Number(config.riskRewardRatio),
    stopLossPips: config.stopLossPips ? Number(config.stopLossPips) : null,
    stopLossPoints: config.stopLossPoints ? Number(config.stopLossPoints) : null,
    lotSizeMethod: config.lotSizeMethod,
    pipValuePerLot: Number(config.pipValuePerLot),
    pointValuePerLot: Number(config.pointValuePerLot),
  });
}

export default function SettingsPanel({ account, config, trades, stats, onUpdate }) {
  const [form, setForm] = useState(config);
  const readyRef = useRef(false);
  const lastSavedRef = useRef(configSnapshot(config));

  useEffect(() => {
    setForm(config);
    lastSavedRef.current = configSnapshot(config);
  }, [config]);

  useEffect(() => {
    readyRef.current = true;
  }, []);

  useEffect(() => {
    if (!readyRef.current || !form) return;
    const snap = configSnapshot(form);
    if (snap === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      const payload = {
        startingBalance: Number(form.startingBalance) || account.startingBalance,
        targetBalance: Number(form.targetBalance) || account.targetBalance,
        targetProfitPercent: Number(form.targetProfitPercent) || account.targetProfitPercent,
        riskPercent: Number(form.riskPercent) || 2,
        riskRewardRatio: Number(form.riskRewardRatio) || 1,
        stopLossPips: form.stopLossPips ? Number(form.stopLossPips) : null,
        stopLossPoints: form.stopLossPoints ? Number(form.stopLossPoints) : null,
        lotSizeMethod: form.lotSizeMethod,
        pipValuePerLot: Number(form.pipValuePerLot) || 10,
        pointValuePerLot: Number(form.pointValuePerLot) || 1,
      };
      const nextSnap = configSnapshot(payload);
      if (nextSnap === lastSavedRef.current) return;
      lastSavedRef.current = nextSnap;
      void onUpdate(payload);
    }, 700);
    return () => clearTimeout(timer);
  }, [form, onUpdate, account]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const balance = getCurrentBalance(config, trades);
  const preview = computeTradePreview(balance, config);

  return (
    <div className="space-y-4">
      <div className={`${card} ${cardBody}`}>
        <h2 className="mb-1 text-sm font-semibold text-zinc-900">Account settings</h2>
        <p className="mb-5 text-xs text-zinc-500">
          Changes save automatically. Editing balance or % recalculates the trade chain.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Starting balance</label>
            <input
              type="number"
              step="0.01"
              className={`${input} tabular-nums`}
              value={form.startingBalance}
              onChange={(e) => setField('startingBalance', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Target balance</label>
            <input
              type="number"
              step="0.01"
              className={`${input} tabular-nums`}
              value={form.targetBalance}
              onChange={(e) => setField('targetBalance', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Profit target per trade (%)</label>
            <input
              type="number"
              step="0.01"
              className={`${input} tabular-nums`}
              value={form.targetProfitPercent}
              onChange={(e) => setField('targetProfitPercent', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Risk per losing trade (%)</label>
            <input
              type="number"
              step="0.01"
              className={`${input} tabular-nums`}
              value={form.riskPercent}
              onChange={(e) => setField('riskPercent', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Risk : reward ratio (1 : x)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className={`${input} tabular-nums`}
              value={form.riskRewardRatio}
              onChange={(e) => setField('riskRewardRatio', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Lot size method</label>
            <CustomDropdown
              className="w-full"
              menuClassName="w-full"
              value={form.lotSizeMethod}
              onChange={(v) => setField('lotSizeMethod', v)}
              options={LOT_SIZE_METHODS}
            />
          </div>
          <div>
            <label className={label}>Stop loss (pips)</label>
            <input
              type="number"
              step="0.1"
              className={`${input} tabular-nums`}
              value={form.stopLossPips ?? ''}
              onChange={(e) => setField('stopLossPips', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Stop loss (points)</label>
            <input
              type="number"
              step="0.1"
              className={`${input} tabular-nums`}
              value={form.stopLossPoints ?? ''}
              onChange={(e) => setField('stopLossPoints', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Pip value / lot ($)</label>
            <input
              type="number"
              step="0.01"
              className={`${input} tabular-nums`}
              value={form.pipValuePerLot}
              onChange={(e) => setField('pipValuePerLot', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Point value / lot ($)</label>
            <input
              type="number"
              step="0.01"
              className={`${input} tabular-nums`}
              value={form.pointValuePerLot}
              onChange={(e) => setField('pointValuePerLot', e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-5 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Next trade risk</div>
            <div className="mt-1 font-semibold tabular-nums text-rose-600">{formatMoney(preview.riskAmount)}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Next target profit</div>
            <div className="mt-1 font-semibold tabular-nums text-emerald-600">{formatMoney(preview.targetProfit)}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400">Suggested lot</div>
            <div className="mt-1 font-semibold tabular-nums text-zinc-900">{preview.suggestedLotSize.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className={`${card} ${cardBody} flex flex-wrap gap-2`}>
        <button
          type="button"
          className={btnOutline}
          onClick={() =>
            downloadCsv(`${account.name || 'compounding'}-trades.csv`, exportTradesToCsv(config, trades, stats))
          }
        >
          Export CSV
        </button>
        <button type="button" className={btnGhost} onClick={() => exportTradesToPdf(config, trades, stats)}>
          Print / PDF
        </button>
        <span className="self-center text-xs text-zinc-400">Exports use the rebuilt trade chain.</span>
      </div>
    </div>
  );
}
