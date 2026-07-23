/** Shared Tailwind class strings — keep landing, auth, and app chrome consistent across Light & Dark modes. */

export const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-45 shadow-xs';

export const btnPrimaryLg = `${btnPrimary} px-8 py-3.5 text-[15px]`;

export const btnPrimaryFull = `${btnPrimary} w-full`;

export const btnOutline =
  'inline-flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-700 dark:hover:text-violet-300 active:scale-[0.98]';

export const btnGhost =
  'inline-flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-violet-700 dark:hover:text-violet-300 active:scale-[0.98]';

export const btnDanger =
  'inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 transition hover:bg-rose-600 hover:text-white active:scale-[0.98]';

export const btnSecondary =
  'inline-flex items-center justify-center rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-2 text-sm font-semibold text-violet-700 dark:text-violet-300 transition hover:bg-violet-100 dark:hover:bg-violet-900/50 active:scale-[0.98]';

export const btnText =
  'inline-flex items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40 px-2.5 py-1 text-sm font-semibold text-violet-600 dark:text-violet-400 transition hover:bg-violet-100 dark:hover:bg-violet-900/60 active:scale-[0.98]';

export const btnSm =
  'inline-flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.98] disabled:opacity-45';

export const btnAuthSubmit =
  'inline-flex items-center justify-center rounded-full bg-violet-600 px-10 py-2.5 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-45 shadow-sm';

export const btnAuthGoogle =
  'flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-45';

export function btnAuthTab(active) {
  return `rounded-lg px-4 py-2 text-lg font-semibold transition active:scale-[0.98] ${
    active ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300'
  }`;
}

export const input =
  'w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15';

export const select = `${input} cursor-pointer`;

export const label = 'mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300';

export const card = 'rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs';

export const cardHd = 'flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3.5 md:px-5';

export const cardTitle = 'text-sm font-semibold text-zinc-900 dark:text-zinc-100';

export const cardBody = 'p-4 md:p-5';

export const dashboardPage = 'w-full min-w-0 px-4 pb-8 pt-4 md:px-6 md:pt-6';

export const dashboardPageWide = 'w-full min-w-0 px-4 pb-8 pt-4 md:px-6 md:pt-6';

export const dashboardPageWideFull =
  'flex h-full min-h-0 w-full min-w-0 flex-col px-4 pb-6 pt-4 md:px-6 md:pt-6';

export const dashboardPageFull =
  'flex h-full min-h-0 w-full min-w-0 flex-col px-4 pb-6 pt-4 md:px-6 md:pt-6';

export const pillToggle =
  'inline-flex gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-1';

export const pillBtn = (active) =>
  `rounded-lg px-3 py-1 text-xs font-medium transition active:scale-[0.98] ${
    active ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
  }`;

export const pageShell =
  'fixed inset-0 z-10 overflow-x-hidden overflow-y-auto bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 [-webkit-overflow-scrolling:touch]';

export const appShell = 'flex h-dvh w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100';

export const msgSuccess = 'text-sm text-emerald-600 dark:text-emerald-400';
export const msgError = 'text-sm text-rose-600 dark:text-rose-400';

export const sectionLabel = 'mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500';

export const emptyState = 'px-4 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500 md:px-5';

export const tableTh =
  'whitespace-nowrap bg-zinc-50 dark:bg-zinc-900/90 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800';
export const tableTd = 'whitespace-nowrap px-4 py-3.5 text-sm text-zinc-700 dark:text-zinc-300';
export const tableTdRight = `${tableTd} text-right tabular-nums`;

export function resultBtn(type, selected) {
  const base = 'flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition active:scale-[0.98]';
  if (!selected) return `${base} border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800`;
  if (type === 'win') return `${base} border-violet-600 bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300`;
  if (type === 'loss') return `${base} border-rose-500 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400`;
  return `${base} border-amber-500 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300`;
}

export function tradeResultBadge(result) {
  const base = 'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide';
  if (result === 'win') return `${base} bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300`;
  if (result === 'loss') return `${base} bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400`;
  return `${base} bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300`;
}
