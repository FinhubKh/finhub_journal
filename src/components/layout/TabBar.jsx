import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuMoon, LuSun } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getUserEmail, getUserDisplayName } from '../../api/auth';
import { btnGhost } from '../../lib/ui';
import { BrandLogo } from '../BrandLogo';

const PRIMARY_TABS = [
  { id: 'overview', label: 'Overview', short: 'Home', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="9" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="6.5" y="5" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="11" y="2" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" /></svg> },
  { id: 'log', label: 'Log', short: 'Log', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" /><path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  { id: 'calendar', label: 'Calendar', short: 'Cal', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  { id: 'checklist', label: 'Checklist', short: 'List', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { id: 'compound', label: 'Compound', short: 'Cmp', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 12.5L6.5 7l2.5 3 4-6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 4h2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  {
    id: 'ai-advisor',
    label: 'Advisor',
    short: 'AI',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2a3.2 3.2 0 00-3.2 3.2v1c0 .4-.15.8-.4 1.1L3.3 9.2A1.2 1.2 0 004.4 11.2h7.2a1.2 1.2 0 001.1-2l-1.1-1.9c-.25-.3-.4-.7-.4-1.1v-1A3.2 3.2 0 008 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6.4 11.6c.3 1 1 1.6 1.6 1.6s1.3-.6 1.6-1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  { id: 'leaderboard', label: 'Leaderboard', short: 'Board', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13h10M5 13V8.5M8 13V4.5M11 13v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M5.5 6.5l2.5-3 2.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> },
];

const TRAILING_TABS = [
  {
    id: 'accounts',
    label: 'Accounts',
    short: 'Acct',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 9.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  { id: 'settings', label: 'Settings', short: 'Set', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg> },
  {
    id: 'setup',
    label: 'How to install',
    short: 'Setup',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 4.5h10v7a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 11.5v-7z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 3v1.5M10.5 3v1.5M6 8.5l1.5 1.5L10.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const MOBILE_TABS = [
  PRIMARY_TABS[0],
  PRIMARY_TABS[1],
  PRIMARY_TABS[2],
  PRIMARY_TABS[3],
  TRAILING_TABS[0],
];

const MORE_TABS = [
  ...PRIMARY_TABS.slice(4),
  ...TRAILING_TABS.slice(1),
];

const SIDEBAR_WIDTH_KEY = 'finhub_sidebar_width';
const SIDEBAR_MIN = 72;
const SIDEBAR_MAX = 196;
const SIDEBAR_DEFAULT = 176;
const SIDEBAR_COMPACT_BELOW = 148;

function readSidebarWidth() {
  try {
    const n = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(n)) return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(n)));
  } catch {
    /* ignore */
  }
  return SIDEBAR_DEFAULT;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export default function TabBar({ activeTab, onSwitchTab }) {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const isDesktop = useIsDesktop();
  const [width, setWidth] = useState(readSidebarWidth);
  const [isHovered, setIsHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(SIDEBAR_DEFAULT);

  const email = getUserEmail(user);
  const displayName = getUserDisplayName(user);
  const isHovering = isDesktop && (isHovered || dragging);
  const navWidth = isDesktop
    ? (isHovering ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_DEFAULT, width)) : SIDEBAR_MIN)
    : 72;
  const expanded = isDesktop && navWidth >= SIDEBAR_COMPACT_BELOW;
  const moreActive = MORE_TABS.some((t) => t.id === activeTab);

  useEffect(() => {
    if (!dragging) return undefined;

    function onMove(e) {
      const next = dragStartWidth.current + (e.clientX - dragStartX.current);
      setWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(next))));
    }

    function onUp() {
      setDragging(false);
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!isDesktop || dragging) return;
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width, isDesktop, dragging]);

  useEffect(() => {
    if (isDesktop) setMoreOpen(false);
  }, [isDesktop]);

  function startDrag(e) {
    if (!isDesktop) return;
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    setDragging(true);
  }

  const tabClass = (active) =>
    `group flex w-full items-center rounded-xl px-2 py-2.5 text-left text-sm font-medium transition ${
      expanded ? 'justify-start gap-3 px-3' : 'justify-center gap-0'
    } ${
      active
        ? 'bg-violet-100 text-violet-700 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border dark:border-emerald-500/30'
        : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200'
    }`;

  if (!isDesktop) {
    return (
      <>
        {moreOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
        ) : null}
        {moreOpen ? (
          <div className="fixed inset-x-0 bottom-16 z-40 max-h-[55dvh] overflow-y-auto border-t border-zinc-200 bg-white px-3 py-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid grid-cols-3 gap-2">
              {MORE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-medium ${
                    activeTab === tab.id
                      ? 'bg-violet-100 text-violet-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'
                  }`}
                  onClick={() => {
                    onSwitchTab(tab.id);
                    setMoreOpen(false);
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
              {isAdmin ? (
                <button
                  type="button"
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-violet-50 px-2 py-3 text-[11px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate('/admin');
                  }}
                >
                  Admin
                </button>
              ) : null}
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl bg-zinc-50 px-2 py-3 text-[11px] font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                onClick={toggleTheme}
              >
                {isDark ? <LuMoon className="h-4 w-4" /> : <LuSun className="h-4 w-4" />}
                Theme
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-xl bg-rose-50 px-2 py-3 text-[11px] font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                onClick={async () => {
                  setMoreOpen(false);
                  await signOut();
                  navigate('/');
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        ) : null}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-950"
          role="tablist"
          aria-label="Main navigation"
        >
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              title={tab.label}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                activeTab === tab.id
                  ? 'text-violet-700 dark:text-emerald-400'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
              onClick={() => {
                setMoreOpen(false);
                onSwitchTab(tab.id);
              }}
            >
              <span>{tab.icon}</span>
              {tab.short}
            </button>
          ))}
          <button
            type="button"
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
              moreOpen || moreActive
                ? 'text-violet-700 dark:text-emerald-400'
                : 'text-zinc-400 dark:text-zinc-500'
            }`}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="3.5" cy="8" r="1.25" fill="currentColor" />
              <circle cx="8" cy="8" r="1.25" fill="currentColor" />
              <circle cx="12.5" cy="8" r="1.25" fill="currentColor" />
            </svg>
            More
          </button>
        </nav>
      </>
    );
  }

  return (
    <nav
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative z-20 hidden h-full shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-950 md:flex ${
        expanded ? 'px-3' : 'px-2'
      } ${dragging ? '' : 'transition-[width] duration-300 ease-in-out'}`}
      style={{ width: navWidth }}
      role="tablist"
      aria-label="Main navigation"
    >
      <div className={`mb-5 flex min-w-0 overflow-hidden px-1 md:mb-6 ${expanded ? 'justify-start md:px-2' : 'justify-center'}`}>
        {expanded ? (
          <BrandLogo size="md" showWordmark />
        ) : (
          <BrandLogo size="sm" showWordmark={false} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-x-hidden">
        {[...PRIMARY_TABS, ...TRAILING_TABS].map((tab) => (
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
            {expanded ? <span className="truncate">{tab.label}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {expanded ? (
          <p className="truncate px-2 text-xs text-zinc-400">{displayName || email}</p>
        ) : null}
        {isAdmin && (
          <button
            type="button"
            className={`${btnGhost} w-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 ${expanded ? 'justify-start' : 'justify-center'}`}
            onClick={() => navigate('/admin')}
            title="Admin panel"
          >
            {expanded ? 'Admin panel' : 'Adm'}
          </button>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className={`${btnGhost} w-full hover:bg-zinc-100 dark:hover:bg-zinc-800 ${expanded ? 'justify-between' : 'justify-center'}`}
          title="Toggle Dark/Light Mode"
        >
          {isDark ? <LuMoon className="h-4 w-4" aria-hidden /> : <LuSun className="h-4 w-4" aria-hidden />}
          {expanded ? (
            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
              {isDark ? 'DARK' : 'LIGHT'}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={`${btnGhost} w-full bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 ${expanded ? 'justify-start' : 'justify-center'}`}
          onClick={async () => { await signOut(); navigate('/'); }}
          title="Sign out"
        >
          {expanded ? 'Sign out' : 'Out'}
        </button>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={SIDEBAR_MIN}
        aria-valuemax={SIDEBAR_MAX}
        aria-valuenow={width}
        tabIndex={0}
        className={`absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none transition ${
          dragging ? 'bg-violet-400/70 dark:bg-emerald-500/60' : 'bg-transparent hover:bg-violet-300/50 dark:hover:bg-emerald-500/40'
        }`}
        onPointerDown={startDrag}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setWidth((w) => Math.max(SIDEBAR_MIN, w - 16));
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            setWidth((w) => Math.min(SIDEBAR_MAX, w + 16));
          }
        }}
      />
    </nav>
  );
}
