import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchEconomicCalendar } from '../../api/market';
import CustomDropdown from '../common/CustomDropdown';
import { ErrorBlock, formatRelativeTime, LoadingBlock } from './marketNewsShared';
import {
  btnOutline,
  card,
  cardHd,
  cardTitle,
  emptyState,
  pillBtn,
  pillToggle,
  sectionLabel,
  tableTd,
  tableTdRight,
  tableTh,
} from '../../lib/ui';

const IMPACT_OPTIONS = ['High', 'Medium', 'Low', 'All'];
const DATE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
];

function isSameLocalDay(iso, ref = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === ref.getFullYear()
    && date.getMonth() === ref.getMonth()
    && date.getDate() === ref.getDate()
  );
}

function formatEventTime(iso, { timeOnly = false } = {}) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  if (timeOnly) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTodayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function impactBadgeClass(impact) {
  if (impact === 'High') return 'bg-rose-100 text-rose-700 ring-rose-200';
  if (impact === 'Medium') return 'bg-amber-100 text-amber-800 ring-amber-200';
  if (impact === 'Holiday') return 'bg-zinc-100 text-zinc-600 ring-zinc-200';
  return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
}

export default function CalendarPanel() {
  const [events, setEvents] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [impactFilter, setImpactFilter] = useState('High');
  const [currencyFilter, setCurrencyFilter] = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchEconomicCalendar();
      setEvents(data.events || []);
      setUpdatedAt(data.updatedAt || null);
      setSource(data.source || '');
    } catch (err) {
      setError(err.message || 'Failed to load economic calendar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currencyOptions = useMemo(() => {
    const codes = new Set(events.map((event) => event.currency).filter(Boolean));
    return ['All', ...Array.from(codes).sort()];
  }, [events]);

  const filteredEvents = useMemo(() => events.filter((event) => {
    const dateOk = dateFilter === 'week' || isSameLocalDay(event.date);
    const impactOk = impactFilter === 'All' || event.impact === impactFilter;
    const currencyOk = currencyFilter === 'All' || event.currency === currencyFilter;
    return dateOk && impactOk && currencyOk;
  }), [events, dateFilter, impactFilter, currencyFilter]);

  if (loading) return <LoadingBlock label="Loading economic calendar..." />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardHd}>
        <div>
          <h3 className={cardTitle}>Economic calendar</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {dateFilter === 'today' ? formatTodayLabel() : 'This week'}
            {source ? ` · ${source}` : ''}
            {updatedAt ? ` · updated ${formatRelativeTime(updatedAt)}` : ''}
          </p>
        </div>
      </div>

      <div className="border-b border-zinc-100 px-4 py-3.5 md:px-5">
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          <div>
            <p className={sectionLabel}>Date</p>
            <div className={`${pillToggle} mt-2`}>
              {DATE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={pillBtn(dateFilter === option.id)}
                  onClick={() => setDateFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={sectionLabel}>Impact</p>
            <div className={`${pillToggle} mt-2`}>
              {IMPACT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={pillBtn(impactFilter === option)}
                  onClick={() => setImpactFilter(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="w-36">
            <p className={sectionLabel}>Currency</p>
            <CustomDropdown
              className="mt-2"
              value={currencyFilter}
              onChange={setCurrencyFilter}
              options={currencyOptions}
              ariaLabel="Filter by currency"
            />
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className={emptyState}>
          <p>
            {dateFilter === 'today' && impactFilter === 'High'
              ? 'No high-impact events scheduled for today.'
              : 'No events match your filters.'}
          </p>
          {(dateFilter !== 'today' || impactFilter !== 'High') && (
            <button
              type="button"
              className={`${btnOutline} mt-4`}
              onClick={() => {
                setDateFilter('today');
                setImpactFilter('High');
                setCurrencyFilter('All');
              }}
            >
              Reset to today · high impact
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className={tableTh}>Time</th>
                <th className={tableTh}>Currency</th>
                <th className={tableTh}>Impact</th>
                <th className={tableTh}>Event</th>
                <th className={`${tableTh} text-right`}>Actual</th>
                <th className={`${tableTh} text-right`}>Forecast</th>
                <th className={`${tableTh} text-right`}>Previous</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEvents.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-50/80">
                  <td className={tableTd}>
                    {formatEventTime(event.date, { timeOnly: dateFilter === 'today' })}
                  </td>
                  <td className={tableTd}>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-700">
                      {event.currency || '—'}
                    </span>
                  </td>
                  <td className={tableTd}>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${impactBadgeClass(event.impact)}`}>
                      {event.impact}
                    </span>
                  </td>
                  <td className={`${tableTd} max-w-[320px] whitespace-normal font-medium text-zinc-900`}>
                    {event.title}
                  </td>
                  <td className={tableTdRight}>
                    <span className={event.actual ? 'font-semibold text-emerald-700' : 'text-zinc-500'}>
                      {event.actual || '—'}
                    </span>
                  </td>
                  <td className={tableTdRight}>{event.forecast || '—'}</td>
                  <td className={tableTdRight}>{event.previous || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
