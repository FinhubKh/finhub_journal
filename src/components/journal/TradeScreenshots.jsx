import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_IMAGES,
  deleteTradeImage,
  fetchTradeImagesWithUrls,
  uploadTradeImage,
  validateTradeImageFile,
} from '../../api/tradeImages';
import { btnGhost, btnOutline, label, msgError } from '../../lib/ui';
import CustomDropdown from '../common/CustomDropdown';

const LABELS = [
  { value: 'Entry', label: 'Entry' },
  { value: 'HTF', label: 'HTF' },
  { value: 'Exit', label: 'Exit' },
  { value: 'Other', label: 'Other' },
];

export default function TradeScreenshots({ tradeId, enabled }) {
  const inputRef = useRef(null);
  const [images, setImages] = useState([]);
  const [labelValue, setLabelValue] = useState('Entry');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const load = useCallback(async () => {
    if (!enabled || !tradeId) {
      setImages([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setImages(await fetchTradeImagesWithUrls(tradeId));
    } catch (err) {
      setError(err.message || 'Could not load screenshots.');
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, tradeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!previewUrl) return;
    function onKey(e) {
      if (e.key === 'Escape') setPreviewUrl(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [previewUrl]);

  if (!enabled) return null;

  async function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    try {
      validateTradeImageFile(file);
      setUploading(true);
      const row = await uploadTradeImage(tradeId, file, labelValue);
      setImages((prev) => [...prev, row]);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handlePaste(e) {
    if (images.length >= MAX_IMAGES || uploading) return;
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) await handleFiles([file]);
  }

  async function handleDelete(image) {
    setBusyId(image.id);
    setError(null);
    try {
      await deleteTradeImage(image);
      setImages((prev) => prev.filter((img) => img.id !== image.id));
    } catch (err) {
      setError(err.message || 'Could not delete image.');
    } finally {
      setBusyId(null);
    }
  }

  const canUpload = images.length < MAX_IMAGES && !uploading && !loading;

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Setup screenshots
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Manual trades only. Upload or paste up to {MAX_IMAGES} chart images (max 5MB each).
        </p>
      </div>

      {error && <p className={msgError}>{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading screenshots...</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <button
                type="button"
                className="block aspect-[4/3] w-full overflow-hidden"
                onClick={() => img.url && setPreviewUrl(img.url)}
              >
                {img.url ? (
                  <img
                    src={img.url}
                    alt={img.label}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">Unavailable</div>
                )}
              </button>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-t border-zinc-100 dark:border-zinc-800">
                <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {img.label}
                </span>
                <button
                  type="button"
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  disabled={busyId === img.id}
                  onClick={() => handleDelete(img)}
                >
                  {busyId === img.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canUpload && (
        <div className="space-y-2 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 p-3">
          <div>
            <label className={label}>Label</label>
            <CustomDropdown
              className="w-full"
              menuClassName="w-full"
              value={labelValue}
              onChange={setLabelValue}
              options={LABELS}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={btnOutline}
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? 'Uploading...' : 'Upload image'}
            </button>
            <span className="self-center text-xs text-zinc-400 dark:text-zinc-500">or paste (Ctrl/Cmd+V)</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {!canUpload && images.length >= MAX_IMAGES && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Screenshot limit reached ({MAX_IMAGES}).</p>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-zinc-900/70 p-4"
          role="presentation"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Screenshot preview" className="max-h-[85vh] w-auto rounded-xl" />
            <button
              className={`${btnGhost} absolute right-2 top-2 bg-white/90`}
              type="button"
              onClick={() => setPreviewUrl(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
