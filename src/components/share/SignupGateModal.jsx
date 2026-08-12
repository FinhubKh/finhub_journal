import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * SignupGateModal
 *
 * A premium frosted-glass conversion modal shown when unauthenticated visitors
 * try to access gated content (Calendar tab, full Trade Log).
 *
 * Props:
 *  - onClose: () => void   — called when the user clicks the backdrop or ✕
 *  - feature: string       — short label like "calendar" or "trade log" for copy
 */
export default function SignupGateModal({ onClose, feature = 'full journal' }) {
  // Lock scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Blurred dark overlay */}
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative gradient top strip */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
        <div className="absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="px-8 pb-8 pt-10 text-center">
          {/* Lock icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/15 text-2xl ring-1 ring-violet-500/30">
            🔒
          </div>

          {/* Headline */}
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">
            Unlock the Full Trader Journal
          </h2>

          {/* Sub-copy */}
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Create a free account to explore the complete{' '}
            <span className="font-medium text-zinc-200">{feature}</span>,
            track your own trades, and build your trading journal.
          </p>

          {/* Perks list */}
          <ul className="my-6 space-y-2 text-left">
            {[
              'Daily P&L calendar with heat-map view',
              'Full trade history & performance stats',
              'Equity curve, win rate & profit factor',
              'AI coaching & trade analytics',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-300">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-[10px] text-violet-400">✓</span>
                {item}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <Link
              to="/login?mode=signup"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 active:scale-[0.98]"
            >
              Create Free Account →
            </Link>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100 active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>

          <p className="mt-4 text-xs text-zinc-600">Free forever · No credit card required</p>
        </div>
      </div>
    </div>
  );
}
