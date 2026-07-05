import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import { TradeModalProvider } from './context/TradeModalContext';
import AuthScreen from './components/AuthScreen';
import TabBar from './components/TabBar';
import TradeModal from './components/TradeModal';
import FluidBackground from './components/FluidBackground';
import OverviewTab from './components/tabs/OverviewTab';
import LogTab from './components/tabs/LogTab';
import CalendarTab from './components/tabs/CalendarTab';
import LeaderboardTab from './components/tabs/LeaderboardTab';
import SettingsTab from './components/tabs/SettingsTab';

function MainApp() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <TradeModalProvider>
      <div className="app" id="main-app">
        <TabBar activeTab={activeTab} onSwitchTab={setActiveTab} />
        <main className="tab-content">
          <div className={`tab-pane tab-pane--overview ${activeTab === 'overview' ? 'active' : ''}`}>{activeTab === 'overview' && <OverviewTab />}</div>
          <div className={`tab-pane ${activeTab === 'log' ? 'active' : ''}`}>{activeTab === 'log' && <LogTab />}</div>
          <div className={`tab-pane ${activeTab === 'calendar' ? 'active' : ''}`}>{activeTab === 'calendar' && <CalendarTab />}</div>
          <div className={`tab-pane ${activeTab === 'leaderboard' ? 'active' : ''}`}>{activeTab === 'leaderboard' && <LeaderboardTab />}</div>
          <div className={`tab-pane ${activeTab === 'settings' ? 'active' : ''}`}>{activeTab === 'settings' && <SettingsTab />}</div>
        </main>
      </div>
      <TradeModal />
    </TradeModalProvider>
  );
}

export default function App() {
  const { isAuthenticated, ready } = useAuth();

  return (
    <>
      <FluidBackground />
      <div className="grain-overlay" aria-hidden="true" />
      <div id="confetti-container" aria-hidden="true" />
      {!ready ? null : !isAuthenticated ? <AuthScreen /> : (
        <AppDataProvider>
          <MainApp />
        </AppDataProvider>
      )}
    </>
  );
}
