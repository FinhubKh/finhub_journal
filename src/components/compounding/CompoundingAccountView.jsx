import { useState } from 'react';
import { useDialog } from '../../context/DialogContext';
import { useCompoundingAccount } from '../../hooks/useCompoundingAccount';
import { formatLocalDate } from '../../lib/compounding/calendarPnL';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { btnDanger, btnGhost, dashboardPageWide, msgError, pillBtn, pillToggle } from '../../lib/ui';
import { MetricCard, SectionBlock } from './CompoundingUI';
import ProgressSection from './ProgressSection';
import TradesToGoalSummary from './TradesToGoalSummary';
import CompoundingSpreadsheet from './CompoundingSpreadsheet';
import CompoundingPnLCalendar from './CompoundingPnLCalendar';
import AnalyticsPanel from './AnalyticsPanel';
import SettingsPanel from './SettingsPanel';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'Trading plan' },
  { id: 'pnl', label: 'P&L' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
];

export default function CompoundingAccountView({ accountId, onBack }) {
  const { confirm } = useDialog();
  const [activeTab, setActiveTab] = useState('plan');
  const [selectedLogDate, setSelectedLogDate] = useState(() => formatLocalDate(new Date()));
  const {
    account,
    config,
    trades,
    stats,
    isLoading,
    isSaving,
    error,
    addTrade,
    updateTrade,
    clearAllTrades,
    updateAccount,
  } = useCompoundingAccount(accountId);

  if (isLoading) {
    return (
      <div className={dashboardPageWide}>
        <p className="text-sm text-zinc-400">Loading compounding plan…</p>
      </div>
    );
  }

  if (error || !account || !config || !stats) {
    return (
      <div className={dashboardPageWide}>
        <button type="button" className={btnGhost} onClick={onBack}>
          Back
        </button>
        <p className={`mt-4 ${msgError}`}>{error || 'Plan not found.'}</p>
      </div>
    );
  }

  const streakLabel =
    stats.currentStreakType === 'win'
      ? `${stats.currentStreak}W streak`
      : stats.currentStreakType === 'loss'
        ? `${stats.currentStreak}L streak`
        : 'No streak';

  return (
    <div className={dashboardPageWide}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button type="button" className={btnGhost} onClick={onBack}>
          Back to plans
        </button>
        {isSaving ? <span className="text-xs text-zinc-400">Saving…</span> : null}
        <button
          type="button"
          className={`${btnDanger} ml-auto`}
          onClick={async () => {
            const ok = await confirm({
              title: 'Clear all trades?',
              message: 'This removes the compounding log for this plan. The plan settings stay.',
              confirmLabel: 'Clear trades',
            });
            if (ok) await clearAllTrades();
          }}
        >
          Clear trades
        </button>
      </div>

      <div className="mb-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-violet-600">{account.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {formatMoney(config.startingBalance)} → {formatMoney(config.targetBalance)}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          <span className="font-medium text-violet-600">{config.targetProfitPercent}%</span> profit per win ·{' '}
          <span className="font-medium text-rose-600">{config.riskPercent}%</span> risk per loss
          {account.tradingAccountId ? ' · linked trading account' : ''}
        </p>
      </div>

      <div className={`${pillToggle} mb-6`}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={pillBtn(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <TradesToGoalSummary config={config} currentBalance={stats.currentBalance} />
          <ProgressSection
            startingBalance={config.startingBalance}
            currentBalance={stats.currentBalance}
            targetBalance={config.targetBalance}
            progressPercent={stats.progressPercent}
          />
          <SectionBlock title="Summary">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              <MetricCard label="Current balance" value={formatMoney(stats.currentBalance)} size="sm" />
              <MetricCard label="Target balance" value={formatMoney(stats.targetBalance)} size="sm" />
              <MetricCard label="Remaining" value={formatMoney(stats.remainingAmount)} size="sm" />
              <MetricCard
                label="Net profit"
                value={formatMoney(stats.netProfit)}
                tone={stats.netProfit >= 0 ? 'positive' : 'negative'}
                size="sm"
              />
              <MetricCard
                label="Win rate"
                value={`${stats.winRate.toFixed(1)}%`}
                tone={stats.winRate >= 50 ? 'positive' : stats.totalTrades ? 'negative' : 'neutral'}
                size="sm"
              />
              <MetricCard label="Wins / losses" value={`${stats.winningTrades} / ${stats.losingTrades}`} size="sm" />
            </div>
          </SectionBlock>
          <SectionBlock title="Risk & streaks">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <MetricCard label="Total trades" value={String(stats.totalTrades)} size="sm" />
              <MetricCard label="Current streak" value={streakLabel} size="sm" />
              <MetricCard label="Best win streak" value={String(stats.bestWinStreak)} tone="positive" size="sm" />
              <MetricCard
                label="Largest drawdown"
                value={`${formatMoney(stats.largestDrawdown)} (${stats.largestDrawdownPercent.toFixed(1)}%)`}
                tone="negative"
                size="sm"
              />
            </div>
          </SectionBlock>
        </div>
      )}

      {activeTab === 'plan' && (
        <CompoundingSpreadsheet
          config={config}
          trades={trades}
          selectedLogDate={selectedLogDate}
          onSelectLogDate={setSelectedLogDate}
          onOpenPnlTab={() => setActiveTab('pnl')}
          addTrade={addTrade}
          updateTrade={updateTrade}
          isSaving={isSaving}
          title={account.name}
        />
      )}

      {activeTab === 'pnl' && (
        <CompoundingPnLCalendar
          trades={trades}
          config={config}
          currentBalance={stats.currentBalance}
          selectedDate={selectedLogDate}
          onSelectDate={setSelectedLogDate}
        />
      )}

      {activeTab === 'analytics' && <AnalyticsPanel config={config} trades={trades} stats={stats} />}

      {activeTab === 'settings' && (
        <SettingsPanel
          account={account}
          config={config}
          trades={trades}
          stats={stats}
          onUpdate={updateAccount}
        />
      )}
    </div>
  );
}
