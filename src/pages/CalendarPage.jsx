import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { fetchTradesByMonth } from '../api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayClass(dts) {
  if (dts.length === 0) return '';
  const dayPnl = dts.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  if (dayPnl > 0) return 'win';
  if (dayPnl < 0) return 'loss';
  return 'be';
}

function MiniMonth({ year, month, trades, onOpen }) {
  const tradeMap = {};
  trades.forEach((t) => { (tradeMap[t.date] ||= []).push(t); });
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div className="cal-mini-cell empty" key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dts = tradeMap[ds] || [];
    const cls = dayClass(dts);
    cells.push(
      <div className={`cal-mini-cell ${cls} ${ds === today ? 'today' : ''}`} key={ds} title={dts.length ? `${dts.length} trade(s)` : ''}>
        {d}
      </div>
    );
  }

  return (
    <div className="cal-mini-month" onClick={() => onOpen(month)}>
      <div className="cal-mini-hd">{MONTHS_SHORT[month - 1]}</div>
      <div className="cal-mini-grid">
        {DAYS.map((d) => <div className="cal-mini-day-hd" key={d}>{d[0]}</div>)}
        {cells}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { activeAccount } = useAppData();
  const now = new Date();
  const [view, setView] = useState('month'); // month | year
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [monthTrades, setMonthTrades] = useState([]);
  const [yearTrades, setYearTrades] = useState({}); // { 1: [...], 2: [...] }
  const [loading, setLoading] = useState(true);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      let data = await fetchTradesByMonth(year, month);
      if (activeAccount) data = data.filter((t) => (t.account || '') === activeAccount);
      setMonthTrades(data);
    } catch (e) { setMonthTrades([]); }
    finally { setLoading(false); }
  }, [year, month, activeAccount]);

  const loadYear = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) => fetchTradesByMonth(year, i + 1))
      );
      const map = {};
      results.forEach((data, i) => {
        map[i + 1] = activeAccount ? data.filter((t) => (t.account || '') === activeAccount) : data;
      });
      setYearTrades(map);
    } catch (e) { setYearTrades({}); }
    finally { setLoading(false); }
  }, [year, activeAccount]);

  useEffect(() => { view === 'month' ? loadMonth() : loadYear(); }, [view, loadMonth, loadYear]);

  function prevMonth() { setMonth((m) => { if (m === 1) { setYear((y) => y - 1); return 12; } return m - 1; }); }
  function nextMonth() { setMonth((m) => { if (m === 12) { setYear((y) => y + 1); return 1; } return m + 1; }); }
  function prevYear() { setYear((y) => y - 1); }
  function nextYear() { setYear((y) => y + 1); }

  const allYearTrades = useMemo(() => Object.values(yearTrades).flat(), [yearTrades]);

  const trades = view === 'month' ? monthTrades : allYearTrades;
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const wins = trades.filter((t) => t.result === 'win').length;
  const wr = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];
  const tradeMap = {};
  monthTrades.forEach((t) => { (tradeMap[t.date] ||= []).push(t); });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div className="cal-cell empty" key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dts = tradeMap[ds] || [];
    const isToday = ds === today;
    const dayPnl = dts.reduce((s, t) => s + (t.pnl_usd || 0), 0);
    const count = dts.length;
    const cls = `cal-cell ${isToday ? 'today' : ''} ${dayClass(dts)}`;
    cells.push(
      <div className={cls} key={ds}>
        <span className="cal-day-num">{d}</span>
        {count > 0 && <span className={`cal-pnl-val ${dayPnl >= 0 ? 'pos' : 'neg'}`}>{dayPnl >= 0 ? '+' : ''}${Math.abs(dayPnl).toFixed(2)}</span>}
        {count > 0 && <span className="cal-count">{count}t</span>}
      </div>
    );
  }

  return (
    <div className="pane-inner">
      <div className="cal-view-toggle">
        <button className={`dash-toggle-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')} type="button">Month</button>
        <button className={`dash-toggle-btn ${view === 'year' ? 'active' : ''}`} onClick={() => setView('year')} type="button">Year</button>
      </div>

      <div className="cal-header">
        <button className="cal-nav" type="button" onClick={view === 'month' ? prevMonth : prevYear}>←</button>
        <h3 className="cal-month">{view === 'month' ? `${MONTHS[month - 1]} ${year}` : year}</h3>
        <button className="cal-nav" type="button" onClick={view === 'month' ? nextMonth : nextYear}>→</button>
      </div>

      <div className="cal-summary">
        <div className="cal-stat">
          <div className={`cal-stat-val ${totalPnl >= 0 ? 'win-col' : 'loss-col'}`}>
            {trades.length > 0 ? (totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`) : '—'}
          </div>
          <div className="cal-stat-lbl">{view === 'month' ? 'Monthly' : 'Yearly'} $</div>
        </div>
        <div className="cal-stat"><div className="cal-stat-val">{trades.length || '—'}</div><div className="cal-stat-lbl">Trades</div></div>
        <div className="cal-stat"><div className="cal-stat-val">{trades.length > 0 ? `${wr}%` : '—'}</div><div className="cal-stat-lbl">Win Rate</div></div>
      </div>

      {loading ? (
        <div className="cal-loading">Loading...</div>
      ) : view === 'month' ? (
        <div className="cal-grid">
          {DAYS.map((d) => <div className="cal-day-hd" key={d}>{d}</div>)}
          {cells}
        </div>
      ) : (
        <div className="cal-year-grid">
          {MONTHS.map((_, i) => (
            <MiniMonth key={i} year={year} month={i + 1} trades={yearTrades[i + 1] || []}
              onOpen={(m) => { setMonth(m); setView('month'); }} />
          ))}
        </div>
      )}

      <div className="cal-legend">
        <span className="legend-item"><span className="legend-dot win" />Profit</span>
        <span className="legend-item"><span className="legend-dot loss" />Loss</span>
        <span className="legend-item"><span className="legend-dot be" />BE</span>
        <span className="legend-item"><span className="legend-dot none" />No trade</span>
      </div>
    </div>
  );
}
