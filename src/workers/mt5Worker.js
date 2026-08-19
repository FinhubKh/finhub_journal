import { parseMt5StrategyTesterHtml } from '../lib/mt5BacktestParse';

self.onmessage = (e) => {
  try {
    const { buffer } = e.data;
    const parsed = parseMt5StrategyTesterHtml(buffer);
    self.postMessage({ success: true, parsed });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
