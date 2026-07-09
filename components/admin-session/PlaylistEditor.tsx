'use client';

// Playlist editor for one custom display, inside the admin session panel.
// Add / remove / reorder creatives and set per-item durations — writing
// custom_display_items via kovio-api (fleet-key auth, org-gated server-side).
// Includes the demo creative library: pick known-good DEMO-badged assets and
// load them as playlist items in one click. >1 item means the next session is
// BLENDED (display-scoped metrics, no campaign bind) — the parent panel reads
// the item count from the onChange callback and gates the campaign picker.

import { useCallback, useEffect, useState } from 'react';
import {
  sessionApi,
  type DemoCreative,
  type DisplayItems,
} from '@/components/admin-session/kovioClient';

const inputCls =
  'rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust';

function Thumb({ url, type }: { url: string; type: 'image' | 'video' }) {
  return (
    <span className="h-9 w-14 shrink-0 overflow-hidden rounded bg-black">
      {type === 'video' ? (
        <video src={url} muted className="h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
    </span>
  );
}

export default function PlaylistEditor({
  displayId,
  disabled,
  live = false,
  onItems,
}: {
  displayId: string;
  /** No fleet key yet — the API calls can't authenticate. */
  disabled: boolean;
  /** A session is live: edits are ALLOWED (the robot and the /display page pick
   *  them up on their next playlist refresh) but shown with an attribution
   *  warning instead of the old hard lock — being unable to fix an empty or
   *  wrong loop mid-demo was worse than the attribution risk. */
  live?: boolean;
  onItems: (payload: DisplayItems) => void;
}) {
  const [data, setData] = useState<DisplayItems | null>(null);
  const [demos, setDemos] = useState<DemoCreative[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showDemos, setShowDemos] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addType, setAddType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = useCallback(
    (payload: DisplayItems) => {
      setData(payload);
      onItems(payload);
    },
    [onItems]
  );

  // Upload straight from disk: store in the public creatives bucket (same
  // pattern as the display creator above) and append as a playlist item.
  async function handleUpload(files: FileList | null) {
    if (!files?.length || disabled) return;
    setError('');
    setUploading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      for (const file of Array.from(files)) {
        const isVid = file.type.startsWith('video');
        if (!isVid && !file.type.startsWith('image')) {
          setError(`${file.name}: only images and video are supported.`);
          continue;
        }
        if (file.size > 100 * 1024 * 1024) {
          setError(`${file.name}: over the 100 MB limit.`);
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `displays/admin/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from('creatives').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) {
          setError(upErr.message || 'Upload failed.');
          continue;
        }
        const { data: pub } = supabase.storage.from('creatives').getPublicUrl(path);
        try {
          apply(
            await sessionApi.addItem(displayId, {
              media_url: pub.publicUrl,
              media_type: isVid ? 'video' : 'image',
            })
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not add the uploaded creative.');
        }
      }
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    sessionApi
      .items(displayId)
      .then((p) => {
        if (!cancelled) apply(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the playlist.');
      });
    return () => {
      cancelled = true;
    };
  }, [displayId, apply]);

  async function run(fn: () => Promise<DisplayItems>) {
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    try {
      apply(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Playlist update failed.');
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: -1 | 1) {
    if (!data) return;
    const ids = data.items.map((i) => i.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(() => sessionApi.reorderItems(displayId, ids));
  }

  async function openDemos() {
    setShowDemos((v) => !v);
    if (demos.length === 0) {
      try {
        setDemos(await sessionApi.demoCreatives());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the demo library.');
      }
    }
  }

  const items = data?.items ?? [];
  const blended = items.length > 1;

  return (
    <div className="mt-4 rounded-lg border border-border-soft bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider opacity-70">
          Playlist · {items.length} creative{items.length === 1 ? '' : 's'}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            blended ? 'bg-rust/10 text-rust' : 'bg-good/10 text-good'
          }`}
        >
          {blended ? 'looping → sessions run BLENDED' : 'single creative → campaign attributable'}
        </span>
      </div>

      {items.length === 0 && (
        <p className="mt-2 text-xs text-ink-2">No creatives yet — add one below or load a demo preset.</p>
      )}

      <div className="mt-2 grid gap-1.5">
        {items.map((it, i) => (
          <div key={it.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-page px-2 py-1.5">
            <span className="w-5 text-center font-mono text-[11px] opacity-50">{i + 1}</span>
            <Thumb url={it.media_url} type={it.media_type} />
            <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{it.media_url.split('/').pop()}</span>
            {it.media_type === 'image' ? (
              <label className="flex items-center gap-1 text-[11px] text-ink-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  defaultValue={it.duration_seconds ?? data?.default_image_seconds ?? 8}
                  disabled={disabled || busy}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (Number.isFinite(v) && v > 0 && v !== it.duration_seconds)
                      void run(() => sessionApi.patchItem(displayId, it.id, v));
                  }}
                  className={`${inputCls} w-16 px-2 py-1 text-xs`}
                />
                s
              </label>
            ) : (
              <span className="text-[11px] opacity-50">plays to end</span>
            )}
            <div className="flex items-center gap-1">
              <button onClick={() => move(i, -1)} disabled={disabled || busy || i === 0} className="rounded border border-border-soft px-1.5 py-0.5 text-xs text-ink hover:bg-card disabled:opacity-30">↑</button>
              <button onClick={() => move(i, 1)} disabled={disabled || busy || i === items.length - 1} className="rounded border border-border-soft px-1.5 py-0.5 text-xs text-ink hover:bg-card disabled:opacity-30">↓</button>
              <button
                onClick={() => void run(() => sessionApi.deleteItem(displayId, it.id))}
                disabled={disabled || busy}
                className="rounded px-1.5 py-0.5 text-xs text-danger hover:opacity-80 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* add by URL (uploads happen in the display creator above; this reuses any hosted asset) */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          placeholder="https://… media URL"
          disabled={disabled || busy}
          className={`${inputCls} min-w-0 flex-1 text-xs`}
        />
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value as 'image' | 'video')}
          disabled={disabled || busy}
          className={`${inputCls} text-xs`}
        >
          <option value="image">image</option>
          <option value="video">video</option>
        </select>
        <button
          onClick={() => {
            const url = addUrl.trim();
            if (!url) return;
            void run(() => sessionApi.addItem(displayId, { media_url: url, media_type: addType }));
            setAddUrl('');
          }}
          disabled={disabled || busy || !addUrl.trim()}
          className="rounded-md border border-border-soft px-3 py-1.5 text-xs text-ink hover:bg-page disabled:opacity-40"
        >
          Add item
        </button>
        <label
          className={`cursor-pointer rounded-md border border-border-soft px-3 py-1.5 text-xs text-ink hover:bg-page ${
            disabled || uploading ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          {uploading ? 'Uploading…' : '⇪ Upload'}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <button
          onClick={() => void openDemos()}
          disabled={disabled}
          className={`rounded-md border px-3 py-1.5 text-xs hover:bg-page disabled:opacity-40 ${showDemos ? 'border-rust text-rust' : 'border-border-soft text-ink'}`}
        >
          {showDemos ? 'Hide demo library' : 'Load demo creatives…'}
        </button>
      </div>

      {showDemos && (
        <div className="mt-3 rounded-md border border-border-soft bg-page p-2">
          {demos.length === 0 ? (
            <p className="text-xs text-ink-2">No demo creatives available for this org yet.</p>
          ) : (
            <>
              <div className="grid gap-1.5">
                {demos.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-card">
                    <input
                      type="checkbox"
                      checked={picked.has(c.id)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(c.id);
                        else next.delete(c.id);
                        setPicked(next);
                      }}
                    />
                    <Thumb url={c.media_url} type={c.media_type} />
                    <span className="min-w-0 flex-1 truncate text-xs text-ink">{c.label}</span>
                    <span className="rounded-full bg-rust/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rust">
                      demo
                    </span>
                    <span className="font-mono text-[10px] opacity-50">
                      {c.media_type === 'image' ? `${c.default_seconds}s` : 'video'}
                      {c.org_id === null ? ' · global' : ''}
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => {
                  const ids = demos.filter((d) => picked.has(d.id)).map((d) => d.id);
                  if (ids.length === 0) return;
                  void run(() => sessionApi.loadPreset(displayId, ids));
                  setPicked(new Set());
                }}
                disabled={disabled || busy || picked.size === 0}
                className="mt-2 rounded-md bg-rust px-3 py-1.5 text-xs text-page hover:bg-rust-dark disabled:opacity-40"
              >
                {busy ? 'Loading…' : `Load ${picked.size || ''} selected into playlist`}
              </button>
              <p className="mt-1.5 font-mono text-[10px] opacity-50">
                Loading more than one creative makes the next session blended — its metrics stay on
                the display and can’t bind a campaign.
              </p>
            </>
          )}
        </div>
      )}

      {disabled && (
        <p className="mt-2 font-mono text-[10px] opacity-50">
          Save a fleet key above to edit the playlist.
        </p>
      )}
      {live && !disabled && (
        <p className="mt-2 rounded-md border border-rust/30 bg-rust/5 px-2.5 py-1.5 text-[11px] text-ink-2">
          Session is live — the screen picks up playlist changes on its next refresh (~20s). If this
          session is campaign-bound, adding creatives mixes exposure; going past one creative means
          future sessions run blended.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
