import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { fetchAllTrades, fetchSteps, fetchModels } from '../api';
import { useAuth } from './AuthContext';

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [allTrades, setAllTrades] = useState([]);
  const [userSteps, setUserSteps] = useState([]);
  const [userModels, setUserModels] = useState([]);
  const [activeAccount, setActiveAccount] = useState('');
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('nxuu_theme');
    if (saved) return saved === 'dark';
    return true;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('nxuu_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggleDark = useCallback(() => setDark((d) => !d), []);

  const refreshTrades = useCallback(async () => {
    try {
      const trades = await fetchAllTrades();
      setAllTrades(trades);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshSteps = useCallback(async () => {
    try { setUserSteps(await fetchSteps()); } catch (e) { setUserSteps([]); }
  }, []);

  const refreshModels = useCallback(async () => {
    try { setUserModels(await fetchModels()); } catch (e) { setUserModels([]); }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshTrades();
      refreshSteps();
      refreshModels();
    } else {
      setAllTrades([]); setUserSteps([]); setUserModels([]); setActiveAccount('');
    }
  }, [isAuthenticated, refreshTrades, refreshSteps, refreshModels]);

  // Accounts list derived from trades
  const accounts = useMemo(
    () => [...new Set(allTrades.map((t) => t.account).filter(Boolean))].sort(),
    [allTrades]
  );

  // Reset activeAccount if it no longer exists
  useEffect(() => {
    if (activeAccount && !accounts.includes(activeAccount)) setActiveAccount('');
  }, [accounts, activeAccount]);

  const accountTrades = useMemo(
    () => (activeAccount ? allTrades.filter((t) => (t.account || '') === activeAccount) : allTrades),
    [allTrades, activeAccount]
  );

  const value = {
    allTrades, accountTrades, accounts, activeAccount, setActiveAccount,
    userSteps, userModels,
    refreshTrades, refreshSteps, refreshModels,
    dark, toggleDark,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}