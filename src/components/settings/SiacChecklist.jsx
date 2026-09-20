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

function StatusMark({ checked }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
        checked
          ? 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950'
          : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300'
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
          <path d="M3.5 6h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/**
 * Read-only SIAC rule checklist with met / open markers.
 */
export default function SiacChecklist({ rules = [], ariaLabel = 'SIAC Eligibility checklist', fill = false }) {
  if (!rules.length) return null;

  const passed = rules.filter((rule) => rule.pass === true).length;
  const open = rules.length - passed;

  if (!fill) {
    return (
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" role="list" aria-label={ariaLabel}>
        {rules.map((rule) => {
          const checked = rule.pass === true;
          const title = RULE_COPY[rule.id] || rule.id;
          return (
            <li key={rule.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusMark checked={checked} />
                <span className={`truncate text-sm font-medium ${checked ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-300'}`}>
                  {title}
                  <span className="sr-only">{checked ? ' — met' : ' — open'}</span>
                </span>
              </div>
              <span className="shrink-0 tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          Rule checklist
        </p>
        <div className="flex items-center gap-2 text-[11px] font-medium tabular-nums">
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {passed} met
          </span>
          {open > 0 ? (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {open} open
            </span>
          ) : null}
        </div>
      </div>

      <ul
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800"
        role="list"
        aria-label={ariaLabel}
      >
        {rules.map((rule, index) => {
          const checked = rule.pass === true;
          const title = RULE_COPY[rule.id] || rule.id;
          const actual = formatRuleActual(rule.id, rule.actual);
          const limit = formatRuleLimit(rule.id, rule.limit);

          return (
            <li
              key={rule.id}
              className={`flex items-start gap-3 px-3.5 py-3.5 sm:items-center sm:gap-4 sm:px-4 ${
                index > 0 ? 'border-t border-zinc-100 dark:border-zinc-800' : ''
              } ${checked ? 'bg-white dark:bg-zinc-950/40' : 'bg-zinc-50/90 dark:bg-zinc-900/50'}`}
            >
              <StatusMark checked={checked} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-semibold ${checked ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-200'}`}>
                    {title}
                    <span className="sr-only">{checked ? ' — met' : ' — open'}</span>
                  </p>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      checked
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {checked ? 'Met' : 'Open'}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs tabular-nums sm:hidden">
                  <span>
                    <span className="text-zinc-400 dark:text-zinc-500">Actual </span>
                    <span className={`font-semibold ${checked ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-200'}`}>
                      {actual}
                    </span>
                  </span>
                  <span>
                    <span className="text-zinc-400 dark:text-zinc-500">Limit </span>
                    <span className="font-medium text-zinc-500 dark:text-zinc-400">{limit}</span>
                  </span>
                </div>
              </div>

              <div className="hidden shrink-0 items-end gap-6 text-right sm:flex">
                <div className="min-w-[7.5rem]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Actual
                  </p>
                  <p className={`mt-0.5 text-sm font-semibold tabular-nums ${checked ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-200'}`}>
                    {actual}
                  </p>
                </div>
                <div className="min-w-[7.5rem]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Limit
                  </p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                    {limit}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
