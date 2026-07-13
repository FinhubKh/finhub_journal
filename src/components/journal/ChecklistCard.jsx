import { useMemo, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { deleteStep } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { unlockAudio, playTick, playUncheck, playFanfare, fireConfetti } from '../../lib/effects';
import ChecklistStepModal from '../modals/ChecklistStepModal';
import { btnGhost, card, cardBody, cardHd, cardTitle } from '../../lib/ui';

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8.5h5L11 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ChecklistCard() {
  const { userSteps, refreshSteps } = useAppData();
  const { alert, confirm } = useDialog();
  const [checked, setChecked] = useState(() => new Set());
  const [editingStep, setEditingStep] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const sections = useMemo(() => {
    const map = {};
    userSteps.forEach((s) => { (map[s.section] ||= []).push(s); });
    return Object.entries(map);
  }, [userSteps]);

  const total = userSteps.length;
  const done = checked.size;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;

  function toggle(id) {
    unlockAudio();
    setChecked((prev) => {
      const next = new Set(prev);
      const willCheck = !next.has(id);
      if (willCheck) next.add(id); else next.delete(id);
      willCheck ? playTick() : playUncheck();
      if (willCheck && next.size === total && total > 0) {
        fireConfetti(document.getElementById('confetti-container'));
        playFanfare();
      }
      return next;
    });
  }

  function handleKey(e, id) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(id); }
  }

  async function handleDelete(step) {
    const ok = await confirm({
      title: 'Delete checklist step?',
      message: `"${step.title}" will be removed.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    setBusyId(step.id);
    try {
      await deleteStep(step.id);
      setChecked((prev) => {
        const next = new Set(prev);
        next.delete(step.id);
        return next;
      });
      await refreshSteps();
    } catch (err) {
      await alert({ title: 'Error', message: 'Could not delete checklist step.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <div className={cardHd}>
        <div>
          <h2 className={cardTitle}>Pre-trade checklist</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Complete before every session.</p>
        </div>
        <span className="text-sm font-bold text-violet-600">{done}<span className="text-zinc-400">/{total}</span></span>
      </div>

      <div className={`${cardBody} shrink-0 border-b border-zinc-100 pt-0`}>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={done} aria-valuemin="0" aria-valuemax={total}>
          <div className="h-full rounded-full bg-violet-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {complete && (
        <div className="shrink-0 border-b border-violet-200 bg-violet-600 px-4 py-3 text-white md:px-5">
          <p className="text-sm font-semibold">Checklist complete</p>
          <p className="text-xs text-violet-100">You are cleared to execute — log the trade after entry.</p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-5">
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">
            No steps configured.<br />Click "+ Add Step" to create checklist items.
          </p>
        ) : (
          <div className="space-y-4">
            {sections.map(([name, steps]) => (
              <div key={name}>
                <div className="mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{name}</span>
                </div>
                <ul className="space-y-1.5">
                  {steps.map((step) => {
                    const isChecked = checked.has(step.id);
                    const busy = busyId === step.id;
                    return (
                      <li key={step.id} className="group">
                        <div
                          className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 transition ${
                            isChecked
                              ? 'border-violet-200 bg-violet-50/60'
                              : 'border-zinc-100 bg-zinc-50/50 hover:border-zinc-200 hover:bg-white'
                          }`}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                            aria-pressed={isChecked}
                            disabled={busy}
                            onClick={() => toggle(step.id)}
                            onKeyDown={(e) => handleKey(e, step.id)}
                          >
                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                              isChecked ? 'border-violet-600 bg-violet-600' : 'border-zinc-300 bg-white'
                            }`}>
                              {isChecked && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                                  <path d="M1 4L3.8 7L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <span className={`min-w-0 flex-1 text-sm leading-snug ${isChecked ? 'text-zinc-400 line-through' : 'text-zinc-800'}`}>
                              {step.title}
                            </span>
                          </button>

                          <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-violet-600"
                              title="Edit step"
                              aria-label="Edit step"
                              disabled={busy}
                              onClick={() => setEditingStep(step)}
                            >
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
                              title="Delete step"
                              aria-label="Delete step"
                              disabled={busy}
                              onClick={() => handleDelete(step)}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex shrink-0 justify-end border-t border-zinc-100 px-4 py-3 md:px-5">
          <button className={btnGhost} type="button" onClick={() => setChecked(new Set())}>Reset</button>
        </div>
      )}

      <ChecklistStepModal
        isOpen={Boolean(editingStep)}
        step={editingStep}
        onClose={() => setEditingStep(null)}
      />
    </div>
  );
}
