import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const config = useMemo(() => (account ? accountToConfig(account) : null), [account]);
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
      if (!accountId || !config) return;
      setIsSaving(true);
      try {
        const useManualPL = input.actualPL !== undefined && !Number.isNaN(input.actualPL);
        const created = await insertCompoundingTrade(accountId, {
          tradeNumber: trades.length + 1,
          date: input.date,
          result: input.result,
          notes: input.notes ?? '',
          useManualPL,
          actualPL: useManualPL ? input.actualPL : undefined,
          calendarTrades: input.calendarTrades,
          calendarWinTrades: input.calendarWinTrades,
          calendarLossTrades: input.calendarLossTrades,
        });
        setTrades(rebuildTradeChain(config, [...trades, created]));
      } finally {
        setIsSaving(false);
      }
    },
    [accountId, config, trades],
  );

  const updateTrade = useCallback(
    async (id, input) => {
      if (!config) return;
      setIsSaving(true);
      try {
        await updateCompoundingTrade(id, input);
        const next = trades.map((t) =>
          t.id === id ? { ...t, ...input, updatedAt: new Date().toISOString() } : t,
        );
        setTrades(rebuildTradeChain(config, next));
      } finally {
        setIsSaving(false);
      }
    },
    [config, trades],
  );

  const deleteTrade = useCallback(
    async (id) => {
      if (!config) return;
      setIsSaving(true);
      try {
        await deleteCompoundingTrade(id);
        const filtered = trades.filter((t) => t.id !== id);
        setTrades(rebuildTradeChain(config, filtered));
      } finally {
        setIsSaving(false);
      }
    },
    [config, trades],
  );

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
      if (!accountId || !account) return;
      setIsSaving(true);
      try {
        const updated = await updateCompoundingAccount(accountId, partial);
        const nextAccount = updated || { ...account, ...partial };
        setAccount(nextAccount);
        setTrades(rebuildTradeChain(accountToConfig(nextAccount), trades));
      } finally {
        setIsSaving(false);
      }
    },
    [account, accountId, trades],
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
