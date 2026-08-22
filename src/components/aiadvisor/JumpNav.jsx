import { useEffect, useRef, useState } from 'react';

const JUMP_SECTIONS = [
  { id: 'risk', label: 'Risk' },
  { id: 'insights', label: 'Insights' },
  { id: 'report', label: 'Report' },
  { id: 'chat', label: 'Chat' },
];

export default function JumpNav({ sectionRefs }) {
  const [activeId, setActiveId] = useState(JUMP_SECTIONS[0].id);
  const observerRef = useRef(null);

  useEffect(() => {
    const entries = JUMP_SECTIONS
      .map((s) => ({ id: s.id, el: sectionRefs.current?.[s.id] }))
      .filter((s) => s.el);
    if (entries.length === 0) return undefined;

    observerRef.current = new IntersectionObserver(
      (observed) => {
        const visible = observed.filter((o) => o.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const match = entries.find((s) => s.el === topMost.target);
        if (match) setActiveId(match.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );

    entries.forEach((s) => observerRef.current.observe(s.el));
    return () => observerRef.current?.disconnect();
  }, [sectionRefs]);

  function jumpTo(id) {
    sectionRefs.current?.[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="sticky top-4 hidden w-32 shrink-0 flex-col gap-1 self-start lg:flex" aria-label="Jump to section">
      {JUMP_SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => jumpTo(s.id)}
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition ${
            activeId === s.id
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
              : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              activeId === s.id ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
            aria-hidden
          />
          {s.label}
        </button>
      ))}
    </nav>
  );
}
