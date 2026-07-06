/** Shared Tailwind class strings — keep landing, auth, and app chrome consistent. */

export const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-45';

export const btnPrimaryLg = `${btnPrimary} px-8 py-3.5 text-[15px]`;

export const btnPrimaryFull = `${btnPrimary} w-full`;

export const btnOutline =
  'inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98]';

export const btnGhost =
  'inline-flex items-center justify-center rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-200 hover:text-violet-700 active:scale-[0.98]';

export const btnDanger =
  'inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-600 hover:text-white active:scale-[0.98]';

export const btnSecondary =
  'inline-flex items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 active:scale-[0.98]';

export const btnText =
  'inline-flex items-center justify-center rounded-lg bg-violet-50 px-2.5 py-1 text-sm font-semibold text-violet-600 transition hover:bg-violet-100 active:scale-[0.98]';

export const btnSm =
  'inline-flex items-center justify-center rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-45';

export const btnAuthSubmit =
  'inline-flex items-center justify-center rounded-full bg-violet-600 px-10 py-2.5 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-45';

export const btnAuthGoogle =
  'flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-45';

export function btnAuthTab(active) {
  return `rounded-lg px-4 py-2 text-lg font-semibold transition active:scale-[0.98] ${
    active ? 'bg-violet-100 text-violet-700' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600'
  }`;
}

export const input =
  'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15';

export const label = 'mb-1.5 block text-sm font-medium text-zinc-700';

export const card = 'rounded-2xl border border-zinc-200 bg-white';

export const cardHd = 'flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 md:px-5';

export const cardTitle = 'text-sm font-semibold text-zinc-900';

export const cardBody = 'p-4 md:p-5';

export const dashboardPage = 'mx-auto w-full min-w-0 max-w-6xl p-4 pb-8 md:p-6';

export const dashboardPageWide = 'mx-auto w-full min-w-0 max-w-[1600px] px-4 pb-8 pt-4 md:px-8 md:pt-6';

export const dashboardPageWideFull =
  'mx-auto flex h-full min-h-[calc(100dvh-3rem)] w-full min-w-0 max-w-[1600px] flex-col px-4 pb-6 pt-4 md:px-8 md:pt-6';

export const dashboardPageFull = 'flex h-full min-h-[calc(100dvh-3rem)] w-full min-w-0 flex-col p-4 pb-6 md:p-6';

export const pillToggle =
  'inline-flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1';

export const pillBtn = (active) =>
  `rounded-lg px-3 py-1 text-xs font-medium transition active:scale-[0.98] ${
    active ? 'bg-white text-zinc-900 shadow-sm' : 'bg-zinc-50 text-zinc-500 hover:bg-white hover:text-zinc-700'
  }`;

export const pageShell =
  'fixed inset-0 z-10 overflow-x-hidden overflow-y-auto bg-zinc-50 text-zinc-900 [-webkit-overflow-scrolling:touch]';

export const appShell = 'flex h-dvh w-full overflow-hidden bg-zinc-50';

export const msgSuccess = 'text-sm text-emerald-600';
export const msgError = 'text-sm text-rose-600';

export const sectionLabel = 'mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400';

export const emptyState = 'px-4 py-10 text-center text-sm text-zinc-400 md:px-5';

export const tableTh =
  'whitespace-nowrap bg-zinc-50 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500';
export const tableTd = 'whitespace-nowrap px-4 py-3.5 text-sm text-zinc-700';
export const tableTdRight = `${tableTd} text-right tabular-nums`;

export function resultBtn(type, selected) {
  const base = 'flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition active:scale-[0.98]';
  if (!selected) return `${base} border-zinc-200 bg-zinc-100 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-200`;
  if (type === 'win') return `${base} border-violet-600 bg-violet-100 text-violet-700`;
  if (type === 'loss') return `${base} border-rose-500 bg-rose-100 text-rose-600`;
  return `${base} border-amber-500 bg-amber-100 text-amber-700`;
}

export function tradeResultBadge(result) {
  const base = 'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide';
  if (result === 'win') return `${base} bg-violet-100 text-violet-700`;
  if (result === 'loss') return `${base} bg-rose-100 text-rose-600`;
  return `${base} bg-amber-100 text-amber-700`;
}
