import { useEffect, useState, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { fetchDailyPnlByYear } from '../api';
import { viewPnlDenomination } from '../lib/accounts';
import AccountViewDropdown from '../components/layout/AccountViewDropdown';
import { overridesToMap } from '../lib/dailyPnl';
import DailyPnlModal from '../components/modals/DailyPnlModal';
import { dashboardPageWide } from '../lib/ui';
import { bucketDailyByMonth, EMPTY_YEAR_BUCKETS } from '../lib/calendarCells';
import { YearView, MonthDetailView } from '../components/calendar/CalendarViews';

export default function CalendarPage() {
  const {
    journalDaily,
    viewMode,
    activeAccount,
    dataLoading,
    refreshTrades,
  } = useAppData();
  const useOverrides = viewMode === 'portfolio';
  const denomination = viewPnlDenomination(viewMode, activeAccount);
  const now = new Date();
  const [screen, setScreen] = useState('year');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dailyOverrides, setDailyOverrides] = useState({});
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [editDay, setEditDay] = useState(null);

  const yearDays = useMemo(
    () => (dataLoading ? EMPTY_YEAR_BUCKETS : bucketDailyByMonth(journalDaily, year)),
    [journalDaily, year, dataLoading],
  );
  const monthDays = yearDays[month] || [];

  useEffect(() => {
    if (!useOverrides) {
      setDailyOverrides({});
      setLoadingOverrides(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingOverrides(true);
    (async () => {
      try {
        const rows = await fetchDailyPnlByYear(year);
        if (!cancelled) setDailyOverrides(overridesToMap(rows));
      } catch {
        if (!cancelled) setDailyOverrides({});
      } finally {
        if (!cancelled) setLoadingOverrides(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, useOverrides]);

  const loadingYear = dataLoading || (useOverrides && loadingOverrides);
  const loadingMonth = dataLoading || (useOverrides && loadingOverrides);

  async function handleDailySaved() {
    if (useOverrides) {
      try {
        const rows = await fetchDailyPnlByYear(year);
        setDailyOverrides(overridesToMap(rows));
      } catch {
        setDailyOverrides({});
      }
    }
    await refreshTrades();
  }

  function openMonth(m) {
    setMonth(m);
    setScreen('detail');
  }

  function goBackToYear() {
    setScreen('year');
  }

  function prevMonth() {
    setMonth((m) => {
      if (m === 1) { setYear((y) => y - 1); return 12; }
      return m - 1;
    });
  }

  function nextMonth() {
    setMonth((m) => {
      if (m === 12) { setYear((y) => y + 1); return 1; }
      return m + 1;
    });
  }

  return (
    <div className={dashboardPageWide}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Calendar</h1>
          <p className="text-sm text-zinc-500">Filter by account or view all accounts.</p>
        </div>
        <AccountViewDropdown />
      </div>
      {screen === 'year' ? (
        <YearView
          year={year}
          yearDays={yearDays}
          overrideMap={dailyOverrides}
          useOverrides={useOverrides}
          denomination={denomination}
          loading={loadingYear}
          onYearChange={setYear}
          onSelectMonth={openMonth}
        />
      ) : (
        <MonthDetailView
          year={year}
          month={month}
          monthDays={monthDays}
          overrideMap={dailyOverrides}
          useOverrides={useOverrides}
          denomination={denomination}
          loading={loadingMonth}
          onBack={goBackToYear}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onEditDay={(date, row, override) => setEditDay({
            date,
            tradesSum: Number(row?.pnl) || 0,
            tradeCount: Number(row?.trades) || 0,
            override,
          })}
        />
      )}

      {editDay && (
        <DailyPnlModal
          date={editDay.date}
          tradesSum={editDay.tradesSum}
          tradeCount={editDay.tradeCount}
          override={editDay.override}
          denomination={denomination}
          onClose={() => setEditDay(null)}
          onSaved={handleDailySaved}
        />
      )}
    </div>
  );
}
