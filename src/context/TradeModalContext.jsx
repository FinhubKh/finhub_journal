import { createContext, useContext, useState, useCallback } from 'react';

const TradeModalContext = createContext(null);

export function TradeModalProvider({ children }) {
  const [trade, setTrade] = useState(null);

  const open = useCallback((t) => setTrade(t), []);
  const close = useCallback(() => setTrade(null), []);

  return (
    <TradeModalContext.Provider value={{ trade, open, close }}>
      {children}
    </TradeModalContext.Provider>
  );
}

export function useTradeModal() {
  const ctx = useContext(TradeModalContext);
  if (!ctx) throw new Error('useTradeModal must be used within TradeModalProvider');
  return ctx;
}
