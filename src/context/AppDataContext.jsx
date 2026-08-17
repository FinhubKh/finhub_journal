import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { fetchSteps, fetchTradingAccounts, fetchJournalBundle } from '../api';
import {
  resolveTradeAccount,
  buildAccountLookups,
} from '../lib/accounts';
import { useAuth } from './AuthContext';

const AppDataContext = createContext(null);

const VIEW_KEY = 'nxuu_view_mode';
const ACCOUNT_KEY = 'nxuu_active_account_id';

const EMPTY_JOURNAL = {
  stats: null,
  daily: [],
  breakdown: { symbol: [], session: [] },
  accounts: [],
};

function readViewMode() {
  const v = localStorage.getItem(VIEW_KEY);
  return v === 'account' ? 'account' : 'portfolio';
}

function readActiveAccountId() {
  return localStorage.getItem(ACCOUNT_KEY) || '';
}

function normalizeStats(stats) {
  if (!stats) return null;
  return {
    ...stats,
    total: Number(stats.total) || 0,
    wins: Number(stats.wins) || 0,
    losses: Number(stats.losses) || 0,
    totalPnl: Number(stats.totalPnl) || 0,
    wr: Number(stats.wr) || 0,
    avgWin: Number(stats.avgWin) || 0,
    avgLoss: Number(stats.avgLoss) || 0,
    avgR: Number(stats.avgR) || 0,
    expectancy: Number(stats.expectancy) || 0,
    bestStreak: Number(stats.bestStreak) || 0,
    worstStreak: Number(stats.worstStreak) || 0,
    maxDD: Number(stats.maxDD) || 0,
    deposits: Number(stats.deposits) || 0,
    withdrawals: Number(stats.withdrawals) || 0,
    netCashflow: Number(stats.netCashflow) || 0,
    balance: stats.balance == null ? null : Number(stats.balance),
  };
}

export function AppDataProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [userSteps, setUserSteps] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [journal, setJournal] = useState(EMPTY_JOURNAL);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [viewMode, setViewModeState] = useState(readViewMode);
  const [activeAccountId, setActiveAccountIdState] = useState(readActiveAccountId);
  const [tradesEpoch, setTradesEpoch] = useState(0);
  const aliveRef = useRef(true);
  const initialDoneRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const scopedAccountId = viewMode === 'account' && activeAccountId ? activeAccountId : null;

  const refreshJournal = useCallback(async () => {
    try {
      const data = await fetchJournalBundle(scopedAccountId);
      if (!aliveRef.current) return;
      setJournal({
        stats: normalizeStats(data?.stats),
        daily: Array.isArray(data?.daily) ? data.daily : [],
        breakdown: {
          symbol: Array.isArray(data?.breakdown?.symbol) ? data.breakdown.symbol : [],
          session: Array.isArray(data?.breakdown?.session) ? data.breakdown.session : [],
        },
        accounts: Array.isArray(data?.accounts) ? data.accounts : [],
      });
      setDataError(null);
    } catch (e) {
      console.error(e);
      if (!aliveRef.current) return;
      setDataError(e?.message || 'Could not load journal stats.');
    }
  }, [scopedAccountId]);

  const refreshTrades = useCallback(async () => {
    await refreshJournal();
    if (aliveRef.current) setTradesEpoch((n) => n + 1);
  }, [refreshJournal]);

  const refreshSteps = useCallback(async () => {
    try {
      const steps = await fetchSteps();
      if (!aliveRef.current) return;
      setUserSteps(steps);
    } catch {
      if (!aliveRef.current) return;
      setUserSteps([]);
    }
  }, []);

  const refreshTradingAccounts = useCallback(async () => {
    try {
      const accounts = await fetchTradingAccounts();
      if (!aliveRef.current) return;
      setTradingAccounts(accounts);
    } catch (e) {
      console.error(e);
      if (!aliveRef.current) return;
      setTradingAccounts([]);
      setDataError(e?.message || 'Could not load accounts.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isAuthenticated) {
        initialDoneRef.current = false;
        if (!cancelled && aliveRef.current) {
          setUserSteps([]);
          setTradingAccounts([]);
          setJournal(EMPTY_JOURNAL);
          setViewModeState('portfolio');
          setActiveAccountIdState('');
          setDataError(null);
          setDataLoading(false);
        }
        return;
      }

      const firstLoad = !initialDoneRef.current;
      if (firstLoad && aliveRef.current) setDataLoading(true);
      try {
        const jobs = [refreshJournal()];
        if (firstLoad) jobs.push(refreshTradingAccounts());
        await Promise.all(jobs);
        initialDoneRef.current = true;
      } finally {
        if (!cancelled && aliveRef.current) setDataLoading(false);
      }

      if (cancelled || !aliveRef.current) return;
      if (firstLoad) void refreshSteps();
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshJournal, refreshSteps, refreshTradingAccounts]);

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

  const accounts = useMemo(
    () => tradingAccounts.map((a) => a.name).sort(),
    [tradingAccounts],
  );

  const lookups = useMemo(() => buildAccountLookups(tradingAccounts), [tradingAccounts]);

  const value = useMemo(() => ({
    journalStats: journal.stats,
    journalDaily: journal.daily,
    journalBreakdown: journal.breakdown,
    journalAccounts: journal.accounts,
    tradesEpoch,
    tradingAccounts,
    dataLoading,
    dataError,
    viewMode,
    activeAccountId,
    activeAccount,
    accounts,
    lookups,
    resolveTradeAccount: (trade) => resolveTradeAccount(trade, lookups),
    setViewMode,
    setActiveAccountId,
    userSteps,
    refreshTrades,
    refreshSteps,
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
  }), [
    journal,
    tradesEpoch,
    tradingAccounts,
    dataLoading,
    dataError,
    viewMode,
    activeAccountId,
    activeAccount,
    accounts,
    lookups,
    setViewMode,
    setActiveAccountId,
    userSteps,
    refreshTrades,
    refreshSteps,
    refreshTradingAccounts,
  ]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
