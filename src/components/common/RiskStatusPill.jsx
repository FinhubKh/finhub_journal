import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { normalizeRiskTrack } from '../../lib/accounts';
import { RISK_RULE_IDS } from '../../lib/riskEligibility';


const PILL_STYLES = {
  eligible: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60',
  not_eligible: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60',
  needs_history: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60',
  unconfigured: 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-800',
};

function asFailedList(value) {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function trackPrefix(track) {
  return track === 'ea' ? 'EA' : 'Master';
}

export function riskStatusPillLabel(account) {
  const track = normalizeRiskTrack(account?.risk_track);
  if (!track) return { tone: 'unconfigured', text: 'Choose risk track' };
  if (account?.risk_eligible === true) {
    return { tone: 'eligible', text: `${trackPrefix(track)} · Eligible` };
  }
  const failed = asFailedList(account?.risk_failed_rules);
  if (failed.includes(RISK_RULE_IDS.HISTORY)) {
    return { tone: 'needs_history', text: 'Needs history' };
  }
  const n = failed.length;
  return {
    tone: 'not_eligible',
    text: `${trackPrefix(track)} · ${n} failing`,
  };
}

/**
 * Compact risk eligibility chip for single-account overview.
 * Hidden in portfolio view.
 */
export default function RiskStatusPill({ className = '', onClick }) {
  const navigate = useNavigate();
  const { viewMode, activeAccount } = useAppData();

  if (viewMode !== 'account' || !activeAccount) return null;

  const { tone, text } = riskStatusPillLabel(activeAccount);

  return (
    <button
      type="button"
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wide transition active:scale-[0.98] ${PILL_STYLES[tone] || PILL_STYLES.unconfigured} ${className}`.trim()}
      title="View risk eligibility checklist"
      onClick={() => {
        if (typeof onClick === 'function') {
          onClick();
          return;
        }
        navigate(`/dashboard/accounts/${activeAccount.id}`);
      }}
    >
      {text}
    </button>
  );
}
