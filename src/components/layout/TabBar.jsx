import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuMoon, LuSun } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getUserEmail, getUserDisplayName } from '../../api/auth';
import { btnGhost } from '../../lib/ui';
import { BrandLogo } from '../BrandLogo';

// News temporarily disabled
// const NEWS_TAB_IDS = ['economic-calendar', 'world-news'];

function Chevron({ open, className = '' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-zinc-400 transition ${open ? 'rotate-180' : ''} ${className}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PRIMARY_TABS = [
  { id: 'overview', label: 'Overview', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="9" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="6.5" y="5" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="11" y="2" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" /></svg> },
  { id: 'log', label: 'Log', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" /><path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  { id: 'calendar', label: 'Calendar', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  { id: 'checklist', label: 'Checklist', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { id: 'compound', label: 'Compound', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 12.5L6.5 7l2.5 3 4-6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 4h2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  {
    id: 'ai-advisor',
    label: 'Advisor',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2a3.2 3.2 0 00-3.2 3.2v1c0 .4-.15.8-.4 1.1L3.3 9.2A1.2 1.2 0 004.4 11.2h7.2a1.2 1.2 0 001.1-2l-1.1-1.9c-.25-.3-.4-.7-.4-1.1v-1A3.2 3.2 0 008 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6.4 11.6c.3 1 1 1.6 1.6 1.6s1.3-.6 1.6-1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  { id: 'leaderboard', label: 'Leaderboard', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13h10M5 13V8.5M8 13V4.5M11 13v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M5.5 6.5l2.5-3 2.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> },
];

/* News temporarily disabled
const NEWS_GROUP = {
  id: 'news',
  label: 'News',
  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2.5h7l3 3V13.5a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" /><path d="M10 2.5V6h3M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  children: [
    {
      id: 'economic-calendar',
      label: 'Economic calendar',
      shortLabel: 'Econ',
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 2v2M11 2v2M2 7h12M5 9.5h2M5 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
    },
    {
      id: 'world-news',
      label: 'World news',
      shortLabel: 'World',
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" /><path d="M2.5 8h11M8 2.5c1.5 1.8 2.3 4 2.3 5.5S9.5 11.7 8 13.5M8 2.5C6.5 4.3 5.7 6.5 5.7 8s.8 3.7 2.3 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
    },
  ],
};
*/

const TRAILING_TABS = [
  { id: 'settings', label: 'Settings', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
];

/* News temporarily disabled
function isNewsTab(activeTab) {
  return NEWS_TAB_IDS.includes(activeTab);
}

function NewsNavGroup({ activeTab, onSwitchTab, tabClass }) {
  const newsActive = isNewsTab(activeTab);
  const [open, setOpen] = useState(newsActive);

  useEffect(() => {
    if (newsActive) setOpen(true);
  }, [newsActive]);

  const subTabClass = (active) =>
    `group flex w-full items-center justify-center gap-0 rounded-lg px-2 py-2 text-left text-sm font-medium transition md:justify-start md:gap-2.5 md:pl-9 md:pr-3 ${
      active
        ? 'bg-violet-100 text-violet-700'
        : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
    }`;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        className={`${tabClass(newsActive)} md:pr-2.5`}
        aria-expanded={open}
        aria-controls="news-nav-items"
        onClick={() => setOpen((value) => !value)}
      >
        <span className={newsActive ? 'text-violet-600' : 'text-zinc-400 group-hover:text-zinc-600'}>
          {NEWS_GROUP.icon}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-left md:inline">{NEWS_GROUP.label}</span>
        <span className="text-[10px] font-semibold md:hidden">News</span>
        <Chevron open={open} className="hidden md:block" />
      </button>

      {open && (
        <div id="news-nav-items" className="flex flex-col gap-0.5" role="group" aria-label="News sections">
          {NEWS_GROUP.children.map((child) => (
            <button
              key={child.id}
              type="button"
              className={subTabClass(activeTab === child.id)}
              role="tab"
              aria-selected={activeTab === child.id}
              title={child.label}
              onClick={() => onSwitchTab(child.id)}
            >
              <span className={activeTab === child.id ? 'text-violet-600' : 'text-zinc-400 group-hover:text-zinc-600'}>
                {child.icon}
              </span>
              <span className="hidden md:inline">{child.label}</span>
              <span className="text-[10px] font-semibold md:hidden">{child.shortLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
*/

export default function TabBar({ activeTab, onSwitchTab }) {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const email = getUserEmail(user);
  const displayName = getUserDisplayName(user);

  const tabClass = (active) =>
    `group flex w-full items-center justify-center gap-0 rounded-xl px-2 py-2.5 text-left text-sm font-medium transition md:justify-start md:gap-3 md:px-3 ${
      active
        ? 'bg-violet-100 text-violet-700 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border dark:border-emerald-500/30'
        : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200'
    }`;

  return (
    <nav className="flex h-full w-[72px] shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-4 md:w-56 md:px-3" role="tablist">
      <div className="mb-5 flex justify-center px-1 md:mb-6 md:justify-start md:px-2">
        <BrandLogo size="md" showWordmark className="hidden md:inline-flex" />
        <BrandLogo size="sm" showWordmark={false} className="md:hidden" />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        {PRIMARY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tabClass(activeTab === tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            title={tab.id === 'ai-advisor' ? 'AI Advisor' : tab.label}
            onClick={() => onSwitchTab(tab.id)}
          >
            <span className={activeTab === tab.id ? 'text-violet-600 dark:text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}>{tab.icon}</span>
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}

        {/* News temporarily disabled
        <NewsNavGroup activeTab={activeTab} onSwitchTab={onSwitchTab} tabClass={tabClass} />
        */}

        {TRAILING_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tabClass(activeTab === tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onSwitchTab(tab.id)}
          >
            <span className={activeTab === tab.id ? 'text-violet-600 dark:text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}>{tab.icon}</span>
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
        <p className="hidden truncate px-2 text-xs text-zinc-400 md:block">{displayName || email}</p>
        {isAdmin && (
          <button
            type="button"
            className={`${btnGhost} w-full justify-center border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 md:justify-start`}
            onClick={() => navigate('/admin')}
          >
            <span className="md:hidden" title="Admin">Adm</span>
            <span className="hidden md:inline">Admin panel</span>
          </button>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className={`${btnGhost} w-full justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800`}
          title="Toggle Dark/Light Mode"
        >
          <span className="flex items-center gap-2">
            {isDark ? <LuMoon className="h-4 w-4" aria-hidden /> : <LuSun className="h-4 w-4" aria-hidden />}
            <span className="hidden text-xs font-semibold md:inline">{isDark ? 'Dark Theme' : 'Light Theme'}</span>
          </span>
          <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
            {isDark ? 'DARK' : 'LIGHT'}
          </span>
        </button>
        <button type="button" className={`${btnGhost} w-full justify-center bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 md:justify-start`} onClick={async () => { await signOut(); navigate('/'); }}>
          <span className="md:hidden" title="Sign out">Out</span>
          <span className="hidden md:inline">Sign out</span>
        </button>
      </div>
    </nav>
  );
}
