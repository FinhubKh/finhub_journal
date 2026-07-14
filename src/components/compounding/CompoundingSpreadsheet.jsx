import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { buildSpreadsheetRows } from '../../lib/compounding/projection';
import { computeTradePreview, getCurrentBalance } from '../../lib/compounding/calculations';
import { aggregateTradesByDate } from '../../lib/compounding/calendarPnL';
import { formatMoney } from '../../lib/compounding/formatMoney';
import {
  btnGhost,
  btnSm,
  card,
  cardHd,
  cardTitle,
  input,
  resultBtn,
  tableTd,
  tableTdRight,
  tableTh,
} from '../../lib/ui';
import { pnlToneClass, StatusBadge } from './CompoundingUI';

export default function CompoundingSpreadsheet({
  config,
  trades,
  selectedLogDate,
  onSelectLogDate,
  onOpenPnlTab,
  addTrade,
  updateTrade,
  isSaving,
  title = 'Trading plan',
}) {
  const pct = config.targetProfitPercent;
  const rows = useMemo(() => buildSpreadsheetRows(config, trades, 20), [config, trades]);
  const currentBalance = getCurrentBalance(config, trades);
  const planPreview = computeTradePreview(currentBalance, config);
  const dayByDate = useMemo(() => aggregateTradesByDate(trades), [trades]);

  const logResult = async (result) => {
    await addTrade({ date: selectedLogDate, result });
    const pl =
      result === 'win' ? planPreview.targetProfit : result === 'loss' ? -planPreview.riskAmount : 0;
    toast.success(`${selectedLogDate}: ${result} · ${formatMoney(pl)}`);
  };

  const setResult = async (tradeId, result) => {
    await updateTrade(tradeId, { result, useManualPL: false });
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardHd}>
        <div>
          <h2 className={cardTitle}>{title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>Logging for:</span>
            <input
              type="date"
              value={selectedLogDate}
              onChange={(e) => onSelectLogDate(e.target.value)}
              className={`${input} !w-auto !px-2 !py-1 tabular-nums`}
            />
            {onOpenPnlTab ? (
              <button type="button" onClick={onOpenPnlTab} className={`${btnGhost} !px-2 !py-1 text-xs`}>
                P&L calendar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
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
                  ? 'bg-violet-50'
                  : row.status === 'completed' && isWin
                    ? 'bg-violet-50/40'
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
                  <td className={tableTdRight}>{formatMoney(row.balanceBefore)}</td>
                  <td className={`${tableTdRight} text-violet-600`}>{formatMoney(row.profitNeeded)}</td>
                  <td className={`${tableTdRight} text-rose-600`}>{formatMoney(-row.riskAmount)}</td>
                  <td className={`${tableTdRight} font-medium`}>
                    <span className={pnlToneClass(row.status === 'completed' ? balanceAfter - row.balanceBefore : 0)}>
                      {formatMoney(balanceAfter)}
                    </span>
                  </td>
                  <td className={tableTdRight}>{row.lotSize.toFixed(2)}</td>
                  <td className={`${tableTd} text-center`}>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className={tableTd}>
                    {row.status === 'current' ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void logResult('win')}
                            className={`${btnSm} !bg-violet-600 !px-2.5 !py-1 !text-xs !text-white hover:!bg-violet-500`}
                          >
                            Win
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void logResult('loss')}
                            className={`${btnSm} !bg-rose-600 !px-2.5 !py-1 !text-xs !text-white hover:!bg-rose-500`}
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
                          className={`${resultBtn('win', isWin)} !flex-none !px-2 !py-0.5`}
                        >
                          Win
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void setResult(row.tradeId, 'loss')}
                          className={`${resultBtn('loss', isLoss)} !flex-none !px-2 !py-0.5`}
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
                        <div className={pnlToneClass(dayPnL.amount)}>{formatMoney(dayPnL.amount)}</div>
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
          Current: <strong className="tabular-nums text-zinc-800">{formatMoney(currentBalance)}</strong>
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
