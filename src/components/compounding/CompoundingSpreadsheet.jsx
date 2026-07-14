import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { buildSpreadsheetRows } from '../../lib/compounding/projection';
import { computeTradePreview, getCurrentBalance } from '../../lib/compounding/calculations';
import { aggregateTradesByDate, formatLocalDate } from '../../lib/compounding/calendarPnL';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { btnGhost, card, tableTd, tableTh } from '../../lib/ui';

export default function CompoundingSpreadsheet({
  config,
  trades,
  selectedLogDate,
  onSelectLogDate,
  onOpenPnlTab,
  actions,
  title = 'Trading plan',
}) {
  const { addTrade, updateTrade, isSaving } = actions;
  const pct = config.targetProfitPercent;
  const rows = useMemo(() => buildSpreadsheetRows(config, trades, 20), [config, trades]);
  const currentBalance = getCurrentBalance(config, trades);
  const planPreview = computeTradePreview(currentBalance, config);
  const dayByDate = useMemo(() => aggregateTradesByDate(trades), [trades]);

  const logResult = async (result) => {
    const date = selectedLogDate || formatLocalDate(new Date());
    await addTrade({ date, result });
    const pl =
      result === 'win'
        ? planPreview.targetProfit
        : result === 'loss'
          ? -planPreview.riskAmount
          : 0;
    toast.success(`${date}: ${result} · ${formatMoney(pl)}`);
  };

  const setResult = async (tradeId, result) => {
    await updateTrade(tradeId, { result, useManualPL: false });
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="border-b border-zinc-100 px-4 py-3.5 md:px-5">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>Logging for:</span>
          <input
            type="date"
            value={selectedLogDate}
            onChange={(e) => onSelectLogDate(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-800 tabular-nums"
          />
          {onOpenPnlTab ? (
            <button type="button" onClick={onOpenPnlTab} className={`${btnGhost} !px-2 !py-1 text-xs`}>
              P&L calendar
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-violet-50/80 text-[11px] uppercase tracking-wide text-violet-700">
              <th className={`${tableTh} text-left`}>Trade #</th>
              <th className={`${tableTh} text-left`}>Date</th>
              <th className={`${tableTh} text-right`}>Balance Before</th>
              <th className={`${tableTh} text-right`}>Profit Needed ({pct}%)</th>
              <th className={`${tableTh} text-right`}>Risk Amount</th>
              <th className={`${tableTh} text-right`}>After Win</th>
              <th className={`${tableTh} text-right`}>Lot Size</th>
              <th className={`${tableTh} text-center`}>Status</th>
              <th className={`${tableTh} text-center`}>Result</th>
              <th className={`${tableTh} text-center`}>Day P&L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isWin = row.result === 'win';
              const isLoss = row.result === 'loss';
              const balanceAfter =
                row.status === 'completed' && row.balanceAfterActual !== undefined
                  ? row.balanceAfterActual
                  : row.balanceAfterWin;
              const rowDate = row.date ?? selectedLogDate;
              const dayPnL = rowDate ? dayByDate[rowDate] : null;
              const rowBg =
                row.status === 'current'
                  ? 'bg-emerald-50'
                  : row.status === 'completed' && isWin
                    ? 'bg-emerald-50/40'
                    : row.status === 'completed' && isLoss
                      ? 'bg-rose-50/50'
                      : row.isProjection
                        ? 'bg-zinc-50/80 text-zinc-400'
                        : '';

              return (
                <tr key={`${row.tradeNumber}-${row.tradeId ?? 'proj'}`} className={`border-b border-zinc-50 ${rowBg}`}>
                  <td className={`${tableTd} tabular-nums font-medium`}>{row.tradeNumber}</td>
                  <td className={`${tableTd} tabular-nums text-xs text-zinc-500`}>
                    {row.status === 'completed' && row.date
                      ? row.date
                      : row.status === 'current'
                        ? selectedLogDate
                        : '—'}
                  </td>
                  <td className={`${tableTd} text-right tabular-nums`}>{formatMoney(row.balanceBefore)}</td>
                  <td className={`${tableTd} text-right tabular-nums text-emerald-600`}>
                    {formatMoney(row.profitNeeded)}
                  </td>
                  <td className={`${tableTd} text-right tabular-nums text-rose-600`}>
                    {formatMoney(-row.riskAmount)}
                  </td>
                  <td className={`${tableTd} text-right tabular-nums font-medium`}>
                    {row.status === 'completed' && isLoss ? (
                      <span className="text-rose-600">{formatMoney(balanceAfter)}</span>
                    ) : row.status === 'completed' && isWin ? (
                      <span className="text-emerald-600">{formatMoney(balanceAfter)}</span>
                    ) : (
                      formatMoney(balanceAfter)
                    )}
                  </td>
                  <td className={`${tableTd} text-right tabular-nums`}>{row.lotSize.toFixed(2)}</td>
                  <td className={`${tableTd} text-center`}>
                    {row.status === 'completed' ? (
                      <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        Done
                      </span>
                    ) : row.status === 'current' ? (
                      <span className="rounded-md border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Next
                      </span>
                    ) : (
                      <span className="rounded-md border border-zinc-100 px-2 py-0.5 text-xs text-zinc-400">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className={tableTd}>
                    {row.status === 'current' ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void logResult('win')}
                            className="min-w-[52px] rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Win
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void logResult('loss')}
                            className="min-w-[52px] rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                          >
                            Loss
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void logResult('breakeven')}
                          className="text-[10px] text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
                        >
                          Breakeven
                        </button>
                      </div>
                    ) : row.status === 'completed' && row.tradeId ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void setResult(row.tradeId, 'win')}
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            isWin ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:text-emerald-700'
                          }`}
                        >
                          Win
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void setResult(row.tradeId, 'loss')}
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            isLoss ? 'bg-rose-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:text-rose-700'
                          }`}
                        >
                          Loss
                        </button>
                      </div>
                    ) : (
                      <span className="block text-center text-xs text-zinc-300">—</span>
                    )}
                  </td>
                  <td className={`${tableTd} text-center text-[10px] tabular-nums text-zinc-500`}>
                    {dayPnL && dayPnL.trades > 0 ? (
                      <div className="leading-tight">
                        <div>
                          {dayPnL.winTrades}W / {dayPnL.lossTrades}L
                        </div>
                        <div className={dayPnL.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatMoney(dayPnL.amount)}
                        </div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500 md:px-5">
        <span>
          Current:{' '}
          <strong className="tabular-nums text-zinc-800">{formatMoney(currentBalance)}</strong>
        </span>
        <span>
          Target: <strong className="tabular-nums text-violet-700">{formatMoney(config.targetBalance)}</strong>
        </span>
        <span>
          {trades.length} trade{trades.length === 1 ? '' : 's'} logged
        </span>
      </div>
    </div>
  );
}
