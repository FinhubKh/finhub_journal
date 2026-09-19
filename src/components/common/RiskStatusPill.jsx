import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { normalizeRiskTrack } from '../../lib/accounts';
import { RISK_RULE_IDS } from '../../lib/riskEligibility';
import SiacLogo from './SiacLogo';

function asFailedList(value) {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function trackPrefix(track) {
  return track === 'ea' ? 'EA' : 'Master';
}

export function riskStatusPillLabel(account) {
  const track = normalizeRiskTrack(account?.risk_track);
  if (!track) return { tone: 'unconfigured', text: 'Set track' };
  if (account?.risk_eligible === true) {
    return { tone: 'eligible', text: `${trackPrefix(track)} · Eligible` };
  }
  const failed = asFailedList(account?.risk_failed_rules);
  if (failed.includes(RISK_RULE_IDS.HISTORY)) {
    return { tone: 'needs_history', text: 'Building history' };
  }
  const n = failed.length;
  return {
    tone: 'not_eligible',
    text: n === 1
      ? `${trackPrefix(track)} · 1 open`
      : `${trackPrefix(track)} · ${n} open`,
  };
}

const TONE_DOT = {
  eligible: 'bg-emerald-500',
  not_eligible: 'bg-zinc-400 dark:bg-zinc-500',
  needs_history: 'bg-zinc-400 dark:bg-zinc-500',
  unconfigured: 'bg-zinc-300 dark:bg-zinc-600',
};

const TOOLBAR_PILL =
  'inline-flex h-10 items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/90 px-4 text-[12px] shadow-sm shadow-zinc-900/5 backdrop-blur-sm transition hover:bg-zinc-50 dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/30 dark:hover:bg-zinc-800/80';

/**
 * Compact SIAC status control for overview header.
 * Hidden in portfolio view.
 */
export default function RiskStatusPill({ className = '', onClick, variant = 'default' }) {
  const navigate = useNavigate();
  const { viewMode, activeAccount } = useAppData();

  if (viewMode !== 'account' || !activeAccount) return null;

  const { tone, text } = riskStatusPillLabel(activeAccount);
  const toolbar = variant === 'toolbar';

  const [primary, secondary] = (() => {
    const parts = text.split(' · ');
    if (parts.length < 2) return [text, null];
    return [parts[0], parts.slice(1).join(' · ')];
  })();

  return (
    <button
      type="button"
      className={
        toolbar
          ? `${TOOLBAR_PILL} ${className}`.trim()
          : `inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800 ${className}`.trim()
      }
      title="View SIAC eligibility"
      onClick={() => {
        if (typeof onClick === 'function') {
          onClick();
          return;
        }
        navigate(`/dashboard/accounts/${activeAccount.id}`);
      }}
    >
      {toolbar ? (
        <>
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">{primary}</span>
          {secondary ? (
            <span className="font-normal text-zinc-400 dark:text-zinc-500">· {secondary}</span>
          ) : null}
        </>
      ) : (
        <>
          <SiacLogo size={14} alt="" />
          <span className="whitespace-nowrap">{text}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone] || TONE_DOT.unconfigured}`} aria-hidden />
        </>
      )}
    </button>
  );
}
