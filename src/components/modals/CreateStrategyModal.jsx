import { useEffect, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { insertModel } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { btnGhost, btnPrimary, card, input } from '../../lib/ui';

export default function CreateStrategyModal({ isOpen, onClose, onCreated }) {
  const { refreshModels } = useAppData();
  const { alert } = useDialog();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      await alert({ title: 'Missing name', message: 'Please enter a strategy name.' });
      return;
    }

    setSaving(true);
    try {
      const rows = await insertModel(trimmed);
      const created = Array.isArray(rows) ? rows[0] : rows;
      await refreshModels();
      onClose();
      if (created?.id && onCreated) onCreated(created);
    } catch (err) {
      await alert({ title: 'Error', message: 'Could not create strategy.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => { if (!saving) onClose(); }}
    >
      <div
        className={`${card} w-full max-w-sm shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-strategy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 id="create-strategy-title" className="text-base font-semibold text-zinc-900">
            Create strategy
          </h2>
          <button className={btnGhost} type="button" disabled={saving} onClick={onClose}>Close</button>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSave}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700" htmlFor="strategy-name">
              Strategy name
            </label>
            <input
              id="strategy-name"
              className={input}
              type="text"
              placeholder="e.g. ICT Model"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="mt-2 flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button className={btnGhost} type="button" disabled={saving} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
