import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { TradeModalProvider } from '../context/TradeModalContext';
import TabBar from '../components/layout/TabBar';
import TradeModal from '../components/modals/TradeModal';
import { appShell } from '../lib/ui';

const OverviewPage = lazy(() => import('./OverviewPage'));
const LogPage = lazy(() => import('./LogPage'));
const CalendarPage = lazy(() => import('./CalendarPage'));
const BacktestsPage = lazy(() => import('./BacktestsPage'));
const BacktestDetailPage = lazy(() => import('./BacktestDetailPage'));
const AccountsPage = lazy(() => import('./AccountsPage'));
const AccountDetailPage = lazy(() => import('./AccountDetailPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));
const SetupPage = lazy(() => import('./SetupPage'));
const ChecklistPage = lazy(() => import('./ChecklistPage'));
const CompoundingPage = lazy(() => import('./CompoundingPage'));
const AiAdvisorPage = lazy(() => import('./AiAdvisorPage'));
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

function DashboardTabContent({ activeTab }) {
  return (
    <>
      {activeTab === 'overview' && <OverviewPage />}
      {activeTab === 'log' && <LogPage />}
      {activeTab === 'calendar' && <CalendarPage />}
      {activeTab === 'backtests' && <BacktestsPage />}
      {activeTab === 'checklist' && <ChecklistPage />}
      {activeTab === 'compound' && <CompoundingPage />}
      {activeTab === 'ai-advisor' && <AiAdvisorPage />}
      {activeTab === 'leaderboard' && <LeaderboardPage embedded />}
      {activeTab === 'settings' && <SettingsPage />}
      {activeTab === 'setup' && <SetupPage />}
    </>
  );
}

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const onAccounts = location.pathname.startsWith('/dashboard/accounts');
  const onBacktests = location.pathname.startsWith('/dashboard/backtests');

  useEffect(() => {
    if (!location.state?.tab) return;
    let tab = location.state.tab;
    let section = location.state.section || null;

    if (tab === 'news' || tab === 'economic-calendar' || tab === 'world-news') {
      tab = 'overview';
    }
    if (tab === 'settings' && (section === 'mt5-setup' || section === 'setup')) {
      tab = 'setup';
      section = null;
    }
    if (tab === 'settings' && section === 'trading-accounts') {
      tab = 'accounts';
    }
    if (tab === 'trading-accounts') {
      tab = 'accounts';
    }

    if (tab === 'accounts') {
      navigate('/dashboard/accounts', { replace: true });
    } else {
      setActiveTab(tab);
      if (onAccounts) navigate('/dashboard', { replace: true });
    }
    window.history.replaceState({}, '');
  }, [location.state, navigate, onAccounts]);

  function switchTab(tab) {
    if (tab === 'accounts') {
      navigate('/dashboard/accounts');
      return;
    }
    if (tab === 'backtests') {
      navigate('/dashboard/backtests', { replace: true });
      return;
    }
    // Other tabs are rendered via state (not URL), so we must navigate away from
    // any `/dashboard/backtests/...` URL to keep the correct view visible.
    navigate('/dashboard', { state: { tab }, replace: true });
  }

  const shellTab = onAccounts ? 'accounts' : (onBacktests ? 'backtests' : activeTab);
  const fillHeight =
    shellTab === 'log'
    || shellTab === 'checklist'
    || shellTab === 'compound'
    || shellTab === 'overview'
    || shellTab === 'setup'
    || onAccounts;

  return (
    <TradeModalProvider>
      <div className={appShell} id="main-app">
        <TabBar activeTab={shellTab} onSwitchTab={switchTab} />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-zinc-50 pb-16 dark:bg-zinc-950 md:pb-0">
          <div
            className={`flex h-full min-h-0 min-w-0 flex-col ${
              fillHeight ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
              <Routes>
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="accounts/:accountId" element={<AccountDetailPage />} />
                <Route path="backtests" element={<BacktestsPage />} />
                <Route path="backtests/:backtestId" element={<BacktestDetailPage />} />
                <Route path="*" element={<DashboardTabContent activeTab={activeTab} />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      <TradeModal />
    </TradeModalProvider>
  );
}
