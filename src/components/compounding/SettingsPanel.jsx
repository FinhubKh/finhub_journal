import { useEffect, useRef, useState } from 'react';
import { computeTradePreview, getCurrentBalance } from '../../lib/compounding/calculations';
import { LOT_SIZE_METHODS } from '../../lib/compounding/types';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { downloadCsv, exportTradesToCsv, exportTradesToPdf } from '../../lib/compounding/export';
import { btnGhost, btnOutline, card, cardBody, input, label, sectionLabel } from '../../lib/ui';
import CustomDropdown from '../common/CustomDropdown';
import { PreviewStat } from './CompoundingUI';

function parseFinite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function configSnapshot(config) {
  return JSON.stringify({
    startingBalance: Number(config.startingBalance),
    targetBalance: Number(config.targetBalance),
    targetProfitPercent: Number(config.targetProfitPercent),
    riskPercent: Number(config.riskPercent),
    riskRewardRatio: Number(config.riskRewardRatio),
    stopLossPips: config.stopLossPips != null && config.stopLossPips !== '' ? Number(config.stopLossPips) : null,
    stopLossPoints: config.stopLossPoints != null && config.stopLossPoints !== '' ? Number(config.stopLossPoints) : null,
    lotSizeMethod: config.lotSizeMethod,
    pipValuePerLot: Number(config.pipValuePerLot),
    pointValuePerLot: Number(config.pointValuePerLot),
  });
}

export default function SettingsPanel({ account, config, trades, stats, onUpdate }) {
  const [form, setForm] = useState(config);
  const lastSavedRef = useRef(configSnapshot(config));
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const snap = configSnapshot(config);
    if (snap === lastSavedRef.current) return;
    setForm(config);
    lastSavedRef.current = snap;
  }, [config]);

  useEffect(() => {
    if (!form) return undefined;
    const snap = configSnapshot(form);
    if (snap === lastSavedRef.current) return undefined;

    const timer = setTimeout(() => {
      const payload = {
        startingBalance: parseFinite(form.startingBalance, account.startingBalance),
        targetBalance: parseFinite(form.targetBalance, account.targetBalance),
        targetProfitPercent: parseFinite(form.targetProfitPercent, account.targetProfitPercent),
        riskPercent: parseFinite(form.riskPercent, account.riskPercent ?? 2),
        riskRewardRatio: parseFinite(form.riskRewardRatio, account.riskRewardRatio ?? 3),
        stopLossPips: form.stopLossPips === '' || form.stopLossPips == null ? null : parseFinite(form.stopLossPips, null),
        stopLossPoints:
          form.stopLossPoints === '' || form.stopLossPoints == null ? null : parseFinite(form.stopLossPoints, null),
        lotSizeMethod: form.lotSizeMethod,
        pipValuePerLot: parseFinite(form.pipValuePerLot, 10),
        pointValuePerLot: parseFinite(form.pointValuePerLot, 1),
      };
      const nextSnap = configSnapshot(payload);
      if (nextSnap === lastSavedRef.current) return;
      lastSavedRef.current = nextSnap;
      void onUpdateRef.current(payload);
    }, 700);

    return () => clearTimeout(timer);
  }, [form, account]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const balance = getCurrentBalance(config, trades);
  const preview = computeTradePreview(balance, config);

  return (
    <div className="space-y-4">
      <div className={`${card} ${cardBody} space-y-6`}>
        <div>
          <h2 className="mb-1 text-sm font-semibold text-zinc-900">Account settings</h2>
          <p className="text-xs text-zinc-500">
            Changes save automatically. Editing balance or % recalculates the trade chain.
          </p>
        </div>

        <div>
          <h3 className={sectionLabel}>Capital & targets</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
        </div>

        <div>
          <h3 className={sectionLabel}>Lot sizing</h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 pt-5 sm:grid-cols-3">
          <PreviewStat label="Next trade risk" value={formatMoney(preview.riskAmount)} tone="negative" />
          <PreviewStat label="Next target profit" value={formatMoney(preview.targetProfit)} tone="positive" />
          <PreviewStat label="Suggested lot" value={preview.suggestedLotSize.toFixed(2)} />
        </div>
      </div>

      <div className={`${card} ${cardBody}`}>
        <h3 className={`${sectionLabel} mb-3`}>Export</h3>
        <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
