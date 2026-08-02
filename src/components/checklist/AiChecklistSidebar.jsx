import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAppData } from '../../context/AppDataContext';
import { generateChecklistWithAi } from '../../api/ai';
import { insertStep } from '../../api';
import { btnGhost, btnPrimary, btnOutline, input, msgError } from '../../lib/ui';

export default function AiChecklistSidebar({ isOpen, onClose, entryModelId = null }) {
  const { userSteps, refreshSteps } = useAppData();
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const scopedCount = useMemo(
    () => userSteps.filter((s) => (entryModelId ? s.entry_model_id === entryModelId : !s.entry_model_id)).length,
    [userSteps, entryModelId],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !generating && !applying) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, generating, applying, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
      setPreview([]);
      setError(null);
      setGenerating(false);
      setApplying(false);
    }
  }, [isOpen]);

  const sections = useMemo(() => {
    const map = {};
    preview.forEach((s) => { (map[s.section] ||= []).push(s); });
    return Object.entries(map);
  }, [preview]);

  if (!isOpen) return null;

  async function handleGenerate(e) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) {
      setError('Describe the checklist you want.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const steps = await generateChecklistWithAi(text);
      setPreview(steps);
    } catch (err) {
      setPreview([]);
      setError(err.message || 'Could not generate checklist.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleApply() {
    if (preview.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      let position = scopedCount;
      for (const step of preview) {
        await insertStep(step.section, step.title, position, entryModelId);
        position += 1;
      }
      await refreshSteps();
      toast.success(`Added ${preview.length} checklist steps`);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save checklist steps.');
    } finally {
      setApplying(false);
    }
  }

  const busy = generating || applying;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
        aria-label="Close AI panel"
        disabled={busy}
        onClick={() => { if (!busy) onClose(); }}
      />

      <aside
        className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-checklist-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>            
            <h2 id="ai-checklist-title" className="text-base font-semibold text-zinc-900">
              Generate checklist
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Preview steps first, then apply them to your checklist.
            </p>
          </div>
          <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>
            Close
          </button>
        </div>

        <form className="space-y-3 border-b border-zinc-100 px-5 py-4" onSubmit={handleGenerate}>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700" htmlFor="ai-checklist-prompt">
            What checklist do you want?
          </label>
          <textarea
            id="ai-checklist-prompt"
            className={`${input} min-h-[110px] resize-y`}
            placeholder="e.g. ICT London open checklist for XAUUSD with risk rules"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
          />
          <div className="flex justify-end gap-2">
            <button className={btnOutline} type="submit" disabled={busy || !prompt.trim()}>
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p className={`${msgError} mb-3`}>{error}</p>}

          {preview.length === 0 && !generating ? (
            <p className="py-10 text-center text-sm text-zinc-400">
              Your AI preview will appear here.
            </p>
          ) : null}

          {generating && (
            <p className="py-10 text-center text-sm text-zinc-500">Writing checklist steps...</p>
          )}

          {sections.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Preview ({preview.length} steps)
              </p>
              {sections.map(([name, steps]) => (
                <div key={name}>
                  <div className="mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{name}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {steps.map((step, idx) => (
                      <li
                        key={`${name}-${idx}-${step.title}`}
                        className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2.5 text-sm text-zinc-800"
                      >
                        {step.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btnPrimary}
            type="button"
            disabled={busy || preview.length === 0}
            onClick={handleApply}
          >
            {applying ? 'Applying...' : (preview.length ? `Apply ${preview.length} steps` : 'Apply steps')}
          </button>
        </div>
      </aside>
    </div>
  );
}
