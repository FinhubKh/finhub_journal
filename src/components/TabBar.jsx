import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserEmail, getUserDisplayName } from '../api/auth';
import AccountSwitcher from './AccountSwitcher';
import { btnGhost } from '../lib/ui';

const TABS = [
  { id: 'overview', label: 'Overview', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="9" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="6.5" y="5" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="11" y="2" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" /></svg> },
  { id: 'log', label: 'Log', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" /><path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  { id: 'calendar', label: 'Calendar', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  { id: 'settings', label: 'Settings', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
];

export default function TabBar({ activeTab, onSwitchTab }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const email = getUserEmail();
  const displayName = getUserDisplayName();

  const tabClass = (active) =>
    `group flex w-full items-center justify-center gap-0 rounded-xl px-2 py-2.5 text-left text-sm font-medium transition md:justify-start md:gap-3 md:px-3 ${
      active
        ? 'bg-violet-100 text-violet-700'
        : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
    }`;

  return (
    <nav className="flex h-full w-[72px] shrink-0 flex-col border-r border-zinc-200 bg-white px-2 py-4 md:w-56 md:px-3" role="tablist">
      <div className="mb-6 hidden px-2 md:block">
        <div className="text-sm font-bold text-zinc-900">FinhubKH</div>
        <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Journal</div>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tabClass(activeTab === t.id)}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => onSwitchTab(t.id)}
          >
            <span className={activeTab === t.id ? 'text-violet-600' : 'text-zinc-400 group-hover:text-zinc-600'}>{t.icon}</span>
            <span className="hidden md:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
        <p className="hidden truncate px-2 text-xs text-zinc-400 md:block">{displayName || email}</p>
        <AccountSwitcher />
        <button type="button" className={`${btnGhost} w-full justify-center bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 md:justify-start`} onClick={async () => { await signOut(); navigate('/'); }}>
          <span className="md:hidden" title="Sign out">Out</span>
          <span className="hidden md:inline">Sign out</span>
        </button>
      </div>
    </nav>
  );
}
