import { useState } from 'react';
import { TradeModalProvider } from '../context/TradeModalContext';
import TabBar from '../components/TabBar';
import TradeModal from '../components/TradeModal';
import OverviewPage from './OverviewPage';
import LogPage from './LogPage';
import CalendarPage from './CalendarPage';
import LeaderboardPage from './LeaderboardPage';
import SettingsPage from './SettingsPage';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <TradeModalProvider>
      <div className="app" id="main-app">
        <TabBar activeTab={activeTab} onSwitchTab={setActiveTab} />
        <main className="tab-content">
          <div className={`tab-pane tab-pane--overview ${activeTab === 'overview' ? 'active' : ''}`}>{activeTab === 'overview' && <OverviewPage />}</div>
          <div className={`tab-pane ${activeTab === 'log' ? 'active' : ''}`}>{activeTab === 'log' && <LogPage />}</div>
          <div className={`tab-pane ${activeTab === 'calendar' ? 'active' : ''}`}>{activeTab === 'calendar' && <CalendarPage />}</div>
          <div className={`tab-pane ${activeTab === 'leaderboard' ? 'active' : ''}`}>{activeTab === 'leaderboard' && <LeaderboardPage />}</div>
          <div className={`tab-pane ${activeTab === 'settings' ? 'active' : ''}`}>{activeTab === 'settings' && <SettingsPage />}</div>
        </main>
      </div>
      <TradeModal />
    </TradeModalProvider>
  );
}
