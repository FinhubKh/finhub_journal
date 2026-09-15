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
 * Read-only SIAC rule checklist with tick / empty checkbox rows.
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
            <div className="min-w-0 flex items-center gap-2.5">
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  checked
                    ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950'
                    : 'border-zinc-300 bg-transparent dark:border-zinc-600'
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
                ) : null}
              </span>
              <span
                className={`font-medium ${
                  checked
                    ? 'text-zinc-800 dark:text-zinc-200'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
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
