import { useEffect, useMemo, useRef, useState } from 'react';

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
  const rootRef = useRef(null);
  const currentYear = new Date().getFullYear();
  const min = minYear ?? currentYear - 12;
  const max = maxYear ?? currentYear + 1;

  const years = useMemo(() => {
    const list = [];
    for (let y = max; y >= min; y--) list.push(y);
    return list;
  }, [min, max]);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
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
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.98]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {value}
        <Chevron open={open} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-30 max-h-56 w-40 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg"
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
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-white text-zinc-700 hover:bg-zinc-100'
                }`}
                onClick={() => pick(y)}
              >
                <span>{y}</span>
                {isThisYear && <span className="text-xs text-violet-600">This year</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
