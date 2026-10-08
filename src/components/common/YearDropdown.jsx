import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function Chevron({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`text-zinc-400 transition ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function YearDropdown({ value, onChange, minYear, maxYear }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const currentYear = new Date().getFullYear();
  const min = minYear ?? currentYear - 12;
  const max = maxYear ?? currentYear + 1;

  const years = useMemo(() => {
    const list = [];
    for (let y = max; y >= min; y--) list.push(y);
    return list;
  }, [min, max]);

  function updateMenuPos() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = 160;
    setMenuPos({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
  }

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPos();
    function onDocClick(e) {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onReposition() {
      updateMenuPos();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  function pick(y) {
    onChange(y);
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-xs transition active:scale-[0.98] dark:bg-zinc-900 dark:text-zinc-100 ${
          open
            ? 'border-violet-300 ring-2 ring-violet-500/15 dark:border-violet-600'
            : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {value}
        <Chevron open={open} />
      </button>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[220] max-h-56 w-40 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
          style={{ top: menuPos.top, left: menuPos.left }}
          role="listbox"
          aria-label="Select year"
        >
          {years.map((y) => {
            const selected = y === value;
            const isThisYear = y === currentYear;
            return (
              <button
                key={y}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  selected
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
                onClick={() => pick(y)}
              >
                <span>{y}</span>
                {isThisYear && <span className="text-xs text-violet-600 dark:text-violet-400">This year</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
