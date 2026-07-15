import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TradeModalProvider } from '../context/TradeModalContext';
import TabBar from '../components/layout/TabBar';
import TradeModal from '../components/modals/TradeModal';
import { appShell } from '../lib/ui';

const OverviewPage = lazy(() => import('./OverviewPage'));
const LogPage = lazy(() => import('./LogPage'));
const CalendarPage = lazy(() => import('./CalendarPage'));
const EconomicCalendarPage = lazy(() => import('./EconomicCalendarPage'));
const WorldNewsPage = lazy(() => import('./WorldNewsPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));
const ChecklistPage = lazy(() => import('./ChecklistPage'));
const CompoundingPage = lazy(() => import('./CompoundingPage'));
const LeaderboardPage = lazy(() => import('./LeaderboardPage'));

function TabFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <span
        className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600"
        aria-hidden
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default function DashboardPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [settingsFocus, setSettingsFocus] = useState(null);

  useEffect(() => {
    if (location.state?.tab) {
      let tab = location.state.tab;
      let section = location.state.section || null;
      if (tab === 'news') tab = 'economic-calendar';
      if (tab === 'setup') {
        tab = 'settings';
        section = section || 'mt5-setup';
      }
      setActiveTab(tab);
      setSettingsFocus(section);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  return (
    <TradeModalProvider>
      <div className={appShell} id="main-app">
        <TabBar activeTab={activeTab} onSwitchTab={setActiveTab} />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-zinc-50">
          <div
            className={`flex h-full min-h-0 min-w-0 flex-col ${
              activeTab === 'log' || activeTab === 'world-news'
                ? 'overflow-hidden'
                : 'overflow-y-auto overscroll-contain'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
              {activeTab === 'overview' && <OverviewPage />}
              {activeTab === 'log' && <LogPage />}
              {activeTab === 'calendar' && <CalendarPage />}
              {activeTab === 'checklist' && <ChecklistPage />}
              {activeTab === 'compound' && <CompoundingPage />}
              {activeTab === 'leaderboard' && <LeaderboardPage embedded />}
              {activeTab === 'economic-calendar' && <EconomicCalendarPage />}
              {activeTab === 'world-news' && <WorldNewsPage />}
              {activeTab === 'settings' && <SettingsPage focusSection={settingsFocus} />}
            </Suspense>
          </div>
        </main>
      </div>
      <TradeModal />
    </TradeModalProvider>
  );
}
