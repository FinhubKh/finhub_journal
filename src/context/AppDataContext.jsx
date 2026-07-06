import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { fetchAllTrades, fetchSteps, fetchModels, fetchTradingAccounts } from '../api';
import {
  filterTradesForView,
  legacyAccountNames,
  resolveTradeAccount,
  buildAccountLookups,
} from '../lib/accounts';
import { useAuth } from './AuthContext';

const AppDataContext = createContext(null);

const VIEW_KEY = 'nxuu_view_mode';
const ACCOUNT_KEY = 'nxuu_active_account_id';

function readViewMode() {
  const v = localStorage.getItem(VIEW_KEY);
  return v === 'account' ? 'account' : 'portfolio';
}

function readActiveAccountId() {
  return localStorage.getItem(ACCOUNT_KEY) || '';
}

export function AppDataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [allTrades, setAllTrades] = useState([]);
  const [userSteps, setUserSteps] = useState([]);
  const [userModels, setUserModels] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [viewMode, setViewModeState] = useState(readViewMode);
  const [activeAccountId, setActiveAccountIdState] = useState(readActiveAccountId);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('nxuu_theme', 'light');
  }, []);

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

  const refreshTradingAccounts = useCallback(async () => {
    try {
      setTradingAccounts(await fetchTradingAccounts());
    } catch (e) {
      console.error(e);
      setTradingAccounts([]);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshTrades();
      refreshSteps();
      refreshModels();
      refreshTradingAccounts();
    } else {
      setAllTrades([]);
      setUserSteps([]);
      setUserModels([]);
      setTradingAccounts([]);
      setViewModeState('portfolio');
      setActiveAccountIdState('');
    }
  }, [isAuthenticated, refreshTrades, refreshSteps, refreshModels, refreshTradingAccounts]);

  const setViewMode = useCallback((mode) => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_KEY, mode);
    if (mode === 'portfolio') {
      setActiveAccountIdState('');
      localStorage.removeItem(ACCOUNT_KEY);
    }
  }, []);

  const setActiveAccountId = useCallback((id) => {
    if (!id) {
      setViewMode('portfolio');
      return;
    }
    setActiveAccountIdState(id);
    setViewModeState('account');
    localStorage.setItem(VIEW_KEY, 'account');
    localStorage.setItem(ACCOUNT_KEY, id);
  }, [setViewMode]);

  const activeAccount = useMemo(
    () => tradingAccounts.find((a) => a.id === activeAccountId) || null,
    [tradingAccounts, activeAccountId],
  );

  useEffect(() => {
    if (viewMode === 'account' && activeAccountId && !activeAccount) {
      setViewMode('portfolio');
    }
  }, [viewMode, activeAccountId, activeAccount, setViewMode]);

  const visibleTrades = useMemo(
    () => filterTradesForView(allTrades, tradingAccounts, viewMode, activeAccountId),
    [allTrades, tradingAccounts, viewMode, activeAccountId],
  );

  const accounts = useMemo(
    () => legacyAccountNames(tradingAccounts, allTrades),
    [tradingAccounts, allTrades],
  );

  const lookups = useMemo(() => buildAccountLookups(tradingAccounts), [tradingAccounts]);

  const value = {
    allTrades,
    visibleTrades,
    accountTrades: visibleTrades,
    tradingAccounts,
    viewMode,
    activeAccountId,
    activeAccount,
    accounts,
    lookups,
    resolveTradeAccount: (trade) => resolveTradeAccount(trade, lookups),
    setViewMode,
    setActiveAccountId,
    userSteps,
    userModels,
    refreshTrades,
    refreshSteps,
    refreshModels,
    refreshTradingAccounts,
    setActiveAccountByName: (name) => {
      if (!name) {
        setViewMode('portfolio');
        return;
      }
      const match = tradingAccounts.find(
        (a) => a.name === name || a.slug === name.toLowerCase(),
      );
      if (match) setActiveAccountId(match.id);
    },
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
