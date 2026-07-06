import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { getUserEmail, getUserDisplayName } from '../api/auth';

const TABS = [
  { id: 'overview', label: 'Overview', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="9" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="6.5" y="5" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="11" y="2" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" /></svg> },
  { id: 'log', label: 'Log', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" /><path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  { id: 'calendar', label: 'Calendar', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  { id: 'leaderboard', label: 'Team', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg> },
  { id: 'settings', label: 'Settings', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
];

export default function TabBar({ activeTab, onSwitchTab }) {
  const { signOut } = useAuth();
  const { accounts, activeAccount, setActiveAccount, dark, toggleDark } = useAppData();
  const email = getUserEmail();
  const displayName = getUserDisplayName();

  return (
    <nav className="tab-bar" role="tablist">
      <div className="tab-bar-logo">
        <div className="app-logo">FinhubKH</div>
        <div className="app-tagline">Journal</div>
      </div>
      {TABS.map((t) => (
        <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} role="tab"
          aria-selected={activeTab === t.id} onClick={() => onSwitchTab(t.id)}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}

      <div className="tab-bar-foot">
        <span className="user-email">{displayName || email}</span>
        {accounts.length > 0 && (
          <div className="account-switcher-wrap">
            <select className="account-switcher" value={activeAccount} onChange={(e) => setActiveAccount(e.target.value)}>
              <option value="">All Accounts</option>
              {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
        <button className="dark-toggle" data-icon={dark ? '☀' : '☾'} onClick={toggleDark} title="Toggle dark mode" type="button">
          <span>Dark Mode</span>
        </button>
        <button className="signout-btn" onClick={signOut} type="button">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
