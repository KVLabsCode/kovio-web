'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { apiClient, type DisplayItemInput } from '@/lib/api-client';
import CopyLinkButton from '@/components/CopyLinkButton';
import type { CustomDisplay } from '@/lib/types';

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

interface EditItem {
  key: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration_seconds: number | null;
}

const btnRust =
  'inline-flex items-center justify-center rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark disabled:opacity-50';
const btnGhost =
  'inline-flex items-center justify-center rounded-md border border-border-soft px-4 py-2.5 text-sm text-ink transition-colors hover:bg-card disabled:opacity-50';
const inputCls =
  'w-full rounded-md border border-border-soft bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-rust';
const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-2';

let keySeq = 0;
const nextKey = () => `it_${keySeq++}`;

function toEditItems(d?: CustomDisplay): EditItem[] {
  return (d?.items ?? []).map((it) => ({
    key: nextKey(),
    media_url: it.media_url,
    media_type: it.media_type,
    duration_seconds: it.duration_seconds,
  }));
}

export default function DisplayEditor({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: CustomDisplay;
}) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? '');
  const [advertiser, setAdvertiser] = useState(initial?.advertiser_name ?? '');
  const [defaultSecs, setDefaultSecs] = useState(initial?.default_image_seconds ?? 8);
  const [items, setItems] = useState<EditItem[]>(() => toEditItems(initial));
  const [status, setStatus] = useState(initial?.status ?? 'active');

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);

  const code = initial?.code ?? null;
  const publicPath = initial?.public_path ?? (code ? `/display/${code}` : null);

  const payloadItems = useMemo<DisplayItemInput[]>(
    () =>
      items.map((it) => ({
        media_url: it.media_url,
        media_type: it.media_type,
        duration_seconds: it.media_type === 'image' ? it.duration_seconds ?? null : null,
      })),
    [items],
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        const isVid = file.type.startsWith('video');
        const isImg = file.type.startsWith('image');
        if (!isVid && !isImg) {
          setUploadErr(`${file.name}: only images and video are supported.`);
          continue;
        }
        if (isImg && file.size > IMAGE_MAX_BYTES) {
          setUploadErr(`${file.name}: image is over the 8 MB limit.`);
          continue;
        }
        if (isVid && file.size > VIDEO_MAX_BYTES) {
          setUploadErr(`${file.name}: video is over the 50 MB limit.`);
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `displays/${code ?? 'new'}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from('creatives')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          setUploadErr(upErr.message || 'Upload failed. Please try again.');
          continue;
        }
        const { data } = supabase.storage.from('creatives').getPublicUrl(path);
        setItems((prev) => [
          ...prev,
          {
            key: nextKey(),
            media_url: data.publicUrl,
            media_type: isVid ? 'video' : 'image',
            duration_seconds: null,
          },
        ]);
      }
    } catch {
      setUploadErr('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function remove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function setDuration(idx: number, raw: string) {
    const n = raw === '' ? null : Math.max(1, Math.min(600, Math.round(Number(raw))));
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, duration_seconds: n } : it)));
  }

  async function save() {
    setSaveErr(null);
    if (!name.trim()) {
      setSaveErr('Give the display a name.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        const { data, error } = await apiClient.oemCreateDisplay({
          name: name.trim(),
          advertiser_name: advertiser.trim() || null,
          default_image_seconds: defaultSecs,
          items: payloadItems,
        });
        if (error || !data) {
          setSaveErr(error?.detail ?? 'Could not create the display.');
          return;
        }
        router.push(`/oem/displays/${data.id}`);
        router.refresh();
        return;
      }
      // edit: persist fields, then replace the playlist.
      const id = initial!.id;
      const upd = await apiClient.oemUpdateDisplay(id, {
        name: name.trim(),
        advertiser_name: advertiser.trim() || null,
        default_image_seconds: defaultSecs,
      });
      if (upd.error) {
        setSaveErr(upd.error.detail ?? 'Could not save changes.');
        return;
      }
      const rep = await apiClient.oemReplaceDisplayItems(id, payloadItems);
      if (rep.error) {
        setSaveErr(rep.error.detail ?? 'Could not save the playlist.');
        return;
      }
      setSavedTick((t) => t + 1);
      setPreviewKey((k) => k + 1);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (mode !== 'edit') return;
    const next = status === 'active' ? 'paused' : 'active';
    const { error } = await apiClient.oemUpdateDisplay(initial!.id, { status: next });
    if (!error) {
      setStatus(next);
      setPreviewKey((k) => k + 1);
      router.refresh();
    }
  }

  async function destroy() {
    if (mode !== 'edit') return;
    if (!confirm('Delete this display? The link will stop working immediately.')) return;
    const { error } = await apiClient.oemDeleteDisplay(initial!.id);
    if (!error) {
      router.push('/oem/displays');
      router.refresh();
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-7">
        <div className="font-mono text-xs uppercase tracking-wide text-ink-2">
          {mode === 'create' ? 'New display' : 'Edit display'}
        </div>
        <h1 className="mt-1 font-serif text-h2 text-ink">
          {mode === 'create' ? 'Custom display.' : name || 'Custom display.'}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Upload one or more creatives, then point a robot screen at the link. Multiple items loop;
          images use their own duration (or the default), videos play to the end.
        </p>
      </div>

      {/* Public link (edit only) */}
      {mode === 'edit' && publicPath && (
        <div className="mb-7 rounded-lg border border-border-soft bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className={labelCls}>Screen link</div>
              <code className="break-all text-sm text-ink">{publicPath}</code>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                  status === 'active' ? 'bg-rust/10 text-rust' : 'border border-border-soft text-ink-2'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-rust' : 'bg-ink-2'}`}
                />
                {status === 'active' ? 'Active' : 'Paused'}
              </span>
              <CopyLinkButton path={publicPath} />
              <a href={publicPath} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                Open
              </a>
            </div>
          </div>
          {status === 'active' && (
            <div className="mt-4 overflow-hidden rounded-md border border-border-soft bg-black">
              <iframe
                key={previewKey}
                src={publicPath}
                title="Display preview"
                className="aspect-video w-full"
              />
            </div>
          )}
        </div>
      )}

      {/* Fields */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="d-name">Display name</label>
          <input
            id="d-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Joe's Coffee — Storefront Loop"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="d-adv">Advertiser (optional)</label>
          <input
            id="d-adv"
            value={advertiser}
            onChange={(e) => setAdvertiser(e.target.value)}
            placeholder="Your advertiser's name"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="d-secs">Default image seconds</label>
          <input
            id="d-secs"
            type="number"
            min={1}
            max={600}
            value={defaultSecs}
            onChange={(e) => setDefaultSecs(Math.max(1, Math.min(600, Number(e.target.value) || 1)))}
            className={inputCls}
          />
        </div>
      </div>

      {/* Creatives */}
      <div className="mt-7">
        <div className="mb-2 flex items-center justify-between">
          <div className={labelCls}>Creatives ({items.length})</div>
          <label className={`${btnGhost} cursor-pointer`}>
            {uploading ? 'Uploading…' : '+ Add creative'}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {uploadErr && <p className="mb-2 text-sm text-danger">{uploadErr}</p>}

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-soft p-8 text-center text-sm text-ink-2">
            No creatives yet. Add an image or video (PNG/JPG/GIF ≤ 8 MB, MP4 ≤ 50 MB).
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it, idx) => (
              <li
                key={it.key}
                className="flex items-center gap-3 rounded-lg border border-border-soft bg-card p-3"
              >
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-black">
                  {it.media_type === 'video' ? (
                    <video src={it.media_url} muted className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.media_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wide text-ink-2">
                    {idx + 1} · {it.media_type}
                  </div>
                  <div className="truncate text-sm text-ink">{it.media_url.split('/').pop()}</div>
                </div>
                {it.media_type === 'image' && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={it.duration_seconds ?? ''}
                      placeholder={String(defaultSecs)}
                      onChange={(e) => setDuration(idx, e.target.value)}
                      className="w-16 rounded-md border border-border-soft bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-rust"
                    />
                    <span className="text-xs text-ink-2">sec</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Move up" onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded p-1.5 text-ink-2 hover:bg-page disabled:opacity-30">▲</button>
                  <button type="button" aria-label="Move down" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="rounded p-1.5 text-ink-2 hover:bg-page disabled:opacity-30">▼</button>
                  <button type="button" aria-label="Remove" onClick={() => remove(idx)} className="rounded p-1.5 text-danger hover:bg-page">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      {saveErr && <p className="mt-5 text-sm text-danger">{saveErr}</p>}
      {savedTick > 0 && !saveErr && <p className="mt-5 text-sm text-rust">Saved.</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving || uploading} className={btnRust}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create display' : 'Save changes'}
        </button>
        {mode === 'edit' && (
          <button type="button" onClick={toggleStatus} className={btnGhost}>
            {status === 'active' ? 'Pause' : 'Activate'}
          </button>
        )}
        <a href="/oem/displays" className={btnGhost}>Cancel</a>
        {mode === 'edit' && (
          <button type="button" onClick={destroy} className="ml-auto text-sm text-danger hover:underline">
            Delete display
          </button>
        )}
      </div>
    </div>
  );
}
