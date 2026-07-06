import { useCallback, useEffect, useState } from 'react';
import { fetchLeaderboard } from '../api';
import { getUserId } from '../api/auth';

function Row({ r, rank, pct, myId, pnlMode }) {
  const rankClass = rank === 0 ? 'gold' : rank === 1 ? 'silver' : rank === 2 ? 'bronze' : '';
  const isMe = r.user_id === myId;
  const pnlStr = r.total_pnl >= 0 ? `+$${r.total_pnl.toFixed(2)}` : `-$${Math.abs(r.total_pnl).toFixed(2)}`;
  return (
    <div className="lb-row">
      <span className={`lb-rank ${rankClass}`}>{rank + 1}</span>
      <div className="lb-bar-wrap"><div className="lb-bar" style={{ width: `${pct}%` }} /></div>
      <span className="lb-name">{r.display_name || r.email?.split('@')[0] || 'Trader'} {isMe && <span className="lb-you-badge">you</span>}</span>
      <div className="lb-meta">
        <span className={pnlMode ? `lb-wr ${r.total_pnl >= 0 ? 'win-col' : 'loss-col'}` : 'lb-wr'}>
          {pnlMode ? pnlStr : `${Math.round(r.win_rate)}%`}
        </span>
        <span className="lb-pnl">{r.total_trades} trades</span>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const myId = getUserId();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchLeaderboard()); }
    catch (e) { setRows(null); console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const empty = !loading && (!rows || rows.length === 0);

  const byWR = rows ? [...rows].sort((a, b) => b.win_rate - a.win_rate) : [];
  const maxWR = byWR[0]?.win_rate || 1;
  const byPnl = rows ? [...rows].sort((a, b) => b.total_pnl - a.total_pnl) : [];
  const maxPnl = Math.max(...byPnl.map((r) => Math.abs(r.total_pnl)), 1);

  return (
    <div className="pane-inner">
      <div className="card">
        <div className="card-hd">
          <h3 className="card-title">Win Rate</h3>
          <button className="text-btn" type="button" onClick={load}>↻ Refresh</button>
        </div>
        {loading ? <div className="lb-empty">Loading...</div> : empty ? (
          <div className="lb-empty">No team members on the leaderboard yet.<br />Enable sharing in Settings.</div>
        ) : byWR.map((r, i) => <Row key={r.user_id} r={r} rank={i} pct={Math.round((r.win_rate / maxWR) * 100)} myId={myId} pnlMode={false} />)}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-hd"><h3 className="card-title">Total PnL</h3></div>
        {loading ? <div className="lb-empty">Loading...</div> : empty ? (
          <div className="lb-empty">No team members on the leaderboard yet.<br />Enable sharing in Settings.</div>
        ) : byPnl.map((r, i) => <Row key={r.user_id} r={r} rank={i} pct={Math.round((Math.abs(r.total_pnl) / maxPnl) * 100)} myId={myId} pnlMode={true} />)}
      </div>

      <p style={{ marginTop: 12, fontSize: 11, fontWeight: 300, color: 'var(--text4)', textAlign: 'center', lineHeight: 1.6 }}>
        Leaderboard shows all users who have opted in via Settings → Share stats with team.
      </p>
    </div>
  );
}
