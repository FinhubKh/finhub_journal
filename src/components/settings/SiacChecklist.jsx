import {
  RULE_COPY,
  SIAC_STATUS_LABELS,
  SIAC_STATUS_STYLES,
  formatRuleActual,
  formatRuleLimit,
} from '../../lib/siacEligibilityUi';

export function SiacStatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SIAC_STATUS_STYLES[status] || SIAC_STATUS_STYLES.unconfigured}`}
    >
      {SIAC_STATUS_LABELS[status] || SIAC_STATUS_LABELS.unconfigured}
    </span>
  );
}

/**
 * Read-only SIAC rule checklist with pass / fail markers.
 */
export default function SiacChecklist({ rules = [], ariaLabel = 'SIAC Eligibility checklist' }) {
  if (!rules.length) return null;

  return (
    <ul className="space-y-1" role="list" aria-label={ariaLabel}>
      {rules.map((rule) => {
        const checked = rule.pass === true;
        const title = RULE_COPY[rule.id] || rule.id;
        return (
          <li
            key={rule.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  checked
                    ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950'
                    : 'border-rose-500 bg-rose-500 text-white dark:border-rose-400 dark:bg-rose-400 dark:text-rose-950'
                }`}
                aria-hidden="true"
              >
                {checked ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 6.2L4.8 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                {title}
                <span className="sr-only">
                  {checked ? ' — met' : ' — not met'}
                </span>
              </span>
            </div>
            <span className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
              {formatRuleActual(rule.id, rule.actual)}
              <span className="mx-1 text-zinc-300 dark:text-zinc-600">/</span>
              {formatRuleLimit(rule.id, rule.limit)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
