import fs from 'fs';
import { parseMt5StrategyTesterHtml, decodeMt5ReportText } from './src/lib/mt5BacktestParse.js';

const buf = fs.readFileSync('./sample_data/Swing Entry at the pullback.html');
const parsed = parseMt5StrategyTesterHtml(buf);

console.log('--- Extracted Metrics ---');
console.log('Sharpe Ratio:', parsed.breakdown.sharpeRatio);
console.log('Recovery Factor:', parsed.breakdown.recoveryFactor);
console.log('Max DD Amount:', parsed.breakdown.maxDdAmount);
console.log('Max DD Percent:', parsed.breakdown.maxDdPercent);
console.log('Best Trade:', parsed.breakdown.maxTradeProfit);
