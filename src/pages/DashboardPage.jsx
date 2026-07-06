import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TradeModalProvider } from '../context/TradeModalContext';
import TabBar from '../components/TabBar';
import TradeModal from '../components/TradeModal';
import OverviewPage from './OverviewPage';
import LogPage from './LogPage';
import CalendarPage from './CalendarPage';
import Mt5SetupPage from './Mt5SetupPage';
import SettingsPage from './SettingsPage';
import { appShell } from '../lib/ui';

export default function DashboardPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [settingsFocus, setSettingsFocus] = useState(null);

  useEffect(() => {
    if (location.state?.tab) {
      const tab = location.state.tab === 'leaderboard' ? 'overview' : location.state.tab;
      setActiveTab(tab);
      setSettingsFocus(location.state.section || null);
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
              activeTab === 'log' ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'
            }`}
          >
            {activeTab === 'overview' && <OverviewPage />}
            {activeTab === 'log' && <LogPage />}
            {activeTab === 'calendar' && <CalendarPage />}
            {activeTab === 'setup' && <Mt5SetupPage />}
            {activeTab === 'settings' && <SettingsPage focusSection={settingsFocus} />}
          </div>
        </main>
      </div>
      <TradeModal />
    </TradeModalProvider>
  );
}
