import { useAppData } from '../context/AppDataContext';
import { computeStats } from '../lib/stats';
import ChecklistCard from '../components/tabs/ChecklistCard';
import EquityChart from '../components/tabs/EquityChart';
import BreakdownCard from '../components/tabs/BreakdownCard';

function fmtPnlStrict(v) {
  return v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
}

export default function OverviewPage() {
  const { accountTrades } = useAppData();
  const stats = computeStats(accountTrades);

  return (
    <div className="pane-inner">
      <div className="ov-layout">
        <div className="ov-col-main">
          <div className="ov-bento">
            <div className="ov-tile ov-tile--hero" data-tone="pnl">
              <span className="ov-tag">Net Result</span>
              <div className={`ov-num ${stats ? (stats.totalPnl >= 0 ? 'win-col' : 'loss-col') : ''}`}>
                {stats ? fmtPnlStrict(stats.totalPnl) : '—'}
              </div>
              <span className="ov-sub">{stats ? `${stats.total} trade${stats.total !== 1 ? 's' : ''}` : '— trades'}</span>
            </div>
            <div className="ov-tile" data-tone="wr">
              <span className="ov-tag">Win Rate</span>
              <div className={`ov-num ov-num--md ${stats ? (stats.wr >= 50 ? 'win-col' : 'loss-col') : ''}`}>
                {stats ? `${stats.wr}%` : '—'}
              </div>
              <span className="ov-sub">{stats ? `${stats.wins.length}W · ${stats.losses.length}L` : '— W · — L'}</span>
            </div>
            <div className="ov-tile" data-tone="pf">
              <span className="ov-tag">Profit Factor</span>
              <div className={`ov-num ov-num--md ${stats && parseFloat(stats.pf) >= 1 ? 'win-col' : stats ? 'loss-col' : ''}`}>
                {stats ? stats.pf : '—'}
              </div>
              <span className="ov-sub">gross W ÷ L</span>
            </div>
            <div className="ov-tile ov-tile--wide" data-tone="exp">
              <span className="ov-tag">Expectancy per trade</span>
              <div className="ov-num ov-num--sm">
                {stats && !isNaN(stats.expectancy) ? `${stats.expectancy >= 0 ? '+' : ''}$${Math.abs(stats.expectancy).toFixed(2)}` : '—'}
              </div>
            </div>
            <div className="ov-tile" data-tone="win">
              <span className="ov-tag">Avg Win</span>
              <div className="ov-num ov-num--sm win-col">{stats && stats.avgWin > 0 ? `+$${stats.avgWin.toFixed(2)}` : '—'}</div>
            </div>
            <div className="ov-tile" data-tone="loss">
              <span className="ov-tag">Avg Loss</span>
              <div className="ov-num ov-num--sm loss-col">{stats && stats.avgLoss > 0 ? `-$${stats.avgLoss.toFixed(2)}` : '—'}</div>
            </div>
            <div className="ov-tile ov-tile--wide" data-tone="r">
              <span className="ov-tag">Avg R</span>
              <div className="ov-num ov-num--sm">{stats ? `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R` : '—'}</div>
            </div>
            <div className="ov-tile ov-tile--streaks" data-tone="streak">
              <span className="ov-tag">Streaks</span>
              <div className="ov-streak-row">
                <div><div className="ov-num ov-num--sm win-col">{stats && stats.bestStreak > 0 ? `${stats.bestStreak}W` : '—'}</div><span className="ov-microlbl">best</span></div>
                <div><div className="ov-num ov-num--sm loss-col">{stats && stats.worstStreak > 0 ? `${stats.worstStreak}L` : '—'}</div><span className="ov-microlbl">worst</span></div>
              </div>
            </div>
            <div className="ov-tile" data-tone="dd">
              <span className="ov-tag">Max Drawdown</span>
              <div className="ov-num ov-num--sm loss-col">{stats && stats.maxDD > 0 ? `-$${stats.maxDD.toFixed(2)}` : '—'}</div>
            </div>
            <div className="ov-tile" data-tone="count">
              <span className="ov-tag">Total Trades</span>
              <div className="ov-num ov-num--sm">{stats ? stats.total : '—'}</div>
            </div>
          </div>

          <EquityChart trades={accountTrades} />
        </div>

        <div className="ov-col-side">
          <ChecklistCard />
          <BreakdownCard trades={accountTrades} />
        </div>
      </div>
    </div>
  );
}
