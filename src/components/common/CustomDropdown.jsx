import { useEffect, useRef, useState } from 'react';

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

function OptionLogo({ src, label }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="h-6 w-6 shrink-0 rounded-md object-cover ring-1 ring-black/5 dark:ring-white/10"
      width={24}
      height={24}
      loading="lazy"
      decoding="async"
      title={label}
    />
  );
}

function normalizeOptions(options) {
  return options.map((option) => {
    if (typeof option === 'string') return { value: option, label: option };
    return option;
  });
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  ariaLabel = 'Select option',
  className = '',
  menuClassName = 'w-36',
  buttonClassName = '',
  disabled = false,
  placeholder = null,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const items = normalizeOptions(options);
  const matched = items.find((item) => item.value === value);
  const selected = matched || (placeholder != null ? null : items[0]);

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

  function pick(nextValue) {
    onChange(nextValue);
    setOpen(false);
  }

  const defaultButton =
    'inline-flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 transition hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40 active:scale-[0.98]';

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        className={buttonClassName || defaultButton}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <OptionLogo src={selected?.logo} label={selected?.label} />
          <span className="truncate">{selected?.label ?? placeholder ?? value}</span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1.5 shadow-xl transition-all ${menuClassName}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {items.map((item) => {
            const isSelected = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold'
                    : 'bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
                }`}
                onClick={() => pick(item.value)}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <OptionLogo src={item.logo} label={item.label} />
                  <span className="truncate">{item.label}</span>
                </span>
                {isSelected && (
                  <svg className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
