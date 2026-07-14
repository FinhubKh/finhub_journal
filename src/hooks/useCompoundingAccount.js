import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteAllCompoundingTrades,
  deleteCompoundingTrade,
  fetchCompoundingAccount,
  fetchCompoundingTrades,
  insertCompoundingTrade,
  updateCompoundingAccount,
  updateCompoundingTrade,
} from '../api/compounding';
import { accountToConfig } from '../lib/compounding/account';
import { computeStats, rebuildTradeChain } from '../lib/compounding/calculations';

export function useCompoundingAccount(accountId) {
  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const accountRef = useRef(account);
  const tradesRef = useRef(trades);
  const configRef = useRef(null);
  accountRef.current = account;
  tradesRef.current = trades;

  const config = useMemo(() => (account ? accountToConfig(account) : null), [account]);
  configRef.current = config;
  const stats = useMemo(() => (config ? computeStats(config, trades) : null), [config, trades]);

  const load = useCallback(async () => {
    if (!accountId) return;
    setIsLoading(true);
    setError(null);
    try {
      const acc = await fetchCompoundingAccount(accountId);
      if (!acc) {
        setAccount(null);
        setTrades([]);
        return;
      }
      setAccount(acc);
      const rows = await fetchCompoundingTrades(accountId);
      setTrades(rebuildTradeChain(accountToConfig(acc), rows));
    } catch (e) {
      setError(e?.message || 'Failed to load compounding account');
      setAccount(null);
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addTrade = useCallback(
    async (input) => {
      const cfg = configRef.current;
      if (!accountId || !cfg) return;
      setIsSaving(true);
      try {
        const current = tradesRef.current;
        const useManualPL = input.actualPL !== undefined && !Number.isNaN(input.actualPL);
        const created = await insertCompoundingTrade(accountId, {
          tradeNumber: current.length + 1,
          date: input.date,
          result: input.result,
          notes: input.notes ?? '',
          useManualPL,
          actualPL: useManualPL ? input.actualPL : undefined,
          calendarTrades: input.calendarTrades,
          calendarWinTrades: input.calendarWinTrades,
          calendarLossTrades: input.calendarLossTrades,
        });
        setTrades(rebuildTradeChain(cfg, [...current, created]));
      } finally {
        setIsSaving(false);
      }
    },
    [accountId],
  );

  const updateTrade = useCallback(async (id, input) => {
    const cfg = configRef.current;
    if (!cfg) return;
    setIsSaving(true);
    try {
      await updateCompoundingTrade(id, input);
      const next = tradesRef.current.map((t) =>
        t.id === id ? { ...t, ...input, updatedAt: new Date().toISOString() } : t,
      );
      setTrades(rebuildTradeChain(cfg, next));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteTrade = useCallback(async (id) => {
    const cfg = configRef.current;
    if (!cfg) return;
    setIsSaving(true);
    try {
      await deleteCompoundingTrade(id);
      const filtered = tradesRef.current.filter((t) => t.id !== id);
      setTrades(rebuildTradeChain(cfg, filtered));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearAllTrades = useCallback(async () => {
    if (!accountId) return;
    setIsSaving(true);
    try {
      await deleteAllCompoundingTrades(accountId);
      setTrades([]);
    } finally {
      setIsSaving(false);
    }
  }, [accountId]);

  const updateAccount = useCallback(
    async (partial) => {
      if (!accountId || !accountRef.current) return;
      setIsSaving(true);
      try {
        const updated = await updateCompoundingAccount(accountId, partial);
        const nextAccount = updated || { ...accountRef.current, ...partial };
        setAccount(nextAccount);
        setTrades(rebuildTradeChain(accountToConfig(nextAccount), tradesRef.current));
      } finally {
        setIsSaving(false);
      }
    },
    [accountId],
  );

  return {
    account,
    config,
    trades,
    stats,
    isLoading,
    isSaving,
    error,
    addTrade,
    updateTrade,
    deleteTrade,
    clearAllTrades,
    updateAccount,
    reload: load,
  };
}
