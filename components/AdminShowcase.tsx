'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  DURATION_OPTIONS,
  generateMetrics,
  fullMetrics,
  youtubeEmbedUrl,
  compact,
  type ShowcaseCampaign,
} from '@/lib/showcase';

const inputCls =
  'rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust';
const metricLabel = 'mb-1 block text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3';

// The hand-editable metric fields (everything else — hourly curve, dwell split,
// attention rate — is derived on save).
const METRIC_FIELDS: Array<{ key: string; label: string; step?: string }> = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'attended', label: 'Verified looks' },
  { key: 'views', label: 'Views' },
  { key: 'captures', label: 'Captures' },
  { key: 'qr_scans', label: 'QR scans' },
  { key: 'touches', label: 'Touches' },
  { key: 'approaches', label: 'Approaches' },
  { key: 'engagements', label: 'Engagements' },
  { key: 'avg_dwell_s', label: 'Avg dwell (s)', step: '0.1' },
  { key: 'foot_traffic_per_hr', label: 'Foot traffic /hr' },
];

type Draft = Record<string, string>;

function toDraft(name: string, location: string, duration: string): Draft {
  const m = generateMetrics(name, location, duration);
  const d: Draft = {};
  for (const f of METRIC_FIELDS) d[f.key] = String((m as unknown as Record<string, number>)[f.key] ?? 0);
  d.peak_window = m.peak_window;
  return d;
}

// Manage a prospect advertiser's showcase campaigns: footage (YouTube link or
// uploaded video) + interaction metrics — auto-generated as a starting point,
// every number hand-editable before saving. Existing campaigns are editable in
// place; the claim page renders whatever is saved here.
export default function AdminShowcase({ orgId, defaultOpen = false }: { orgId: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<ShowcaseCampaign[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoKind, setVideoKind] = useState<'youtube' | 'file'>('youtube');
  const [uploading, setUploading] = useState(false);
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState(DURATION_OPTIONS[0].label);
  const [draft, setDraft] = useState<Draft>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Until the admin hand-edits a number, the draft tracks the generator.
  useEffect(() => {
    if (touched) return;
    if (!name.trim()) {
      setDraft({});
      return;
    }
    setDraft(toDraft(name.trim(), location.trim(), duration));
  }, [name, location, duration, touched]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('kovio_admin_showcases', { p_org_id: orgId });
    setItems((data as ShowcaseCampaign[]) ?? []);
    setLoading(false);
  }

  if (defaultOpen && !loadedOnce) {
    setLoadedOnce(true);
    void load();
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) void load();
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setVideoUrl('');
    setVideoKind('youtube');
    setLocation('');
    setDuration(DURATION_OPTIONS[0].label);
    setDraft({});
    setTouched(false);
    setError('');
  }

  function startEdit(s: ShowcaseCampaign) {
    const m = fullMetrics(s);
    setEditingId(s.id ?? null);
    setName(s.name);
    setVideoUrl(s.video_url ?? '');
    setVideoKind(s.video_kind);
    setLocation(s.location_label ?? '');
    setDuration(s.duration_label ?? DURATION_OPTIONS[0].label);
    const d: Draft = {};
    for (const f of METRIC_FIELDS) d[f.key] = String((m as unknown as Record<string, number>)[f.key] ?? 0);
    d.peak_window = m.peak_window;
    setDraft(d);
    setTouched(true); // never clobber loaded values with the generator
    setError('');
  }

  async function handleUpload(file: File) {
    if (!file.type.startsWith('video')) return setError('Upload a video file (MP4/WebM/MOV).');
    if (file.size > 100 * 1024 * 1024) return setError('Video is over the 100 MB limit.');
    setError('');
    setUploading(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `showcase/${orgId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('creatives').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        setError(upErr.message || 'Upload failed.');
        return;
      }
      const { data } = supabase.storage.from('creatives').getPublicUrl(path);
      setVideoUrl(data.publicUrl);
      setVideoKind('file');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) return setError('Name the campaign.');
    if (videoKind === 'youtube' && videoUrl && !youtubeEmbedUrl(videoUrl))
      return setError('That doesn’t look like a YouTube link.');
    setBusy(true);
    setError('');

    // Base (hourly curve, dwell split, peak) from the generator, then overlay
    // the hand-edited numbers and recompute the attention rate.
    const base = generateMetrics(name.trim(), location.trim(), duration);
    const num = (k: string, fallback: number) => {
      const v = parseFloat(draft[k] ?? '');
      return Number.isFinite(v) && v >= 0 ? v : fallback;
    };
    const impressions = Math.round(num('impressions', base.impressions));
    const attended = Math.round(num('attended', base.attended));
    const metrics = {
      ...base,
      impressions,
      attended,
      attention_rate: impressions > 0 ? attended / impressions : 0,
      views: Math.round(num('views', base.views)),
      captures: Math.round(num('captures', base.captures)),
      qr_scans: Math.round(num('qr_scans', base.qr_scans)),
      touches: Math.round(num('touches', base.touches)),
      approaches: Math.round(num('approaches', base.approaches)),
      engagements: Math.round(num('engagements', base.engagements)),
      avg_dwell_s: num('avg_dwell_s', base.avg_dwell_s),
      foot_traffic_per_hr: Math.round(num('foot_traffic_per_hr', base.foot_traffic_per_hr)),
      peak_window: (draft.peak_window ?? base.peak_window).trim() || base.peak_window,
    };

    const supabase = createClient();
    const args = {
      p_name: name.trim(),
      p_video_url: videoUrl.trim() || null,
      p_video_kind: videoKind,
      p_location: location.trim() || null,
      p_duration: duration,
      p_metrics: metrics,
    };
    const { error } = editingId
      ? await supabase.rpc('kovio_admin_update_showcase', { p_id: editingId, ...args })
      : await supabase.rpc('kovio_admin_add_showcase', { p_org_id: orgId, ...args });
    setBusy(false);
    if (error) {
      setError(editingId ? 'Could not save the changes.' : 'Could not add the campaign.');
      return;
    }
    resetForm();
    await load();
    router.refresh();
  }

  async function remove(id?: string) {
    if (!id) return;
    const supabase = createClient();
    await supabase.rpc('kovio_admin_delete_showcase', { p_id: id });
    if (editingId === id) resetForm();
    await load();
    router.refresh();
  }

  const rate =
    parseFloat(draft.impressions ?? '') > 0
      ? Math.round((parseFloat(draft.attended ?? '0') / parseFloat(draft.impressions)) * 100)
      : null;

  return (
    <div className="mt-2">
      {!defaultOpen && (
        <button onClick={toggle} className="text-sm text-rust transition-colors hover:text-rust-dark">
          {open ? 'Hide showcase campaigns ▴' : 'Showcase campaigns ▾'}
        </button>
      )}

      {open && (
        <div className="mt-2 rounded-lg border border-border-soft bg-page p-4">
          {loading ? (
            <p className="text-sm text-ink-3">Loading…</p>
          ) : (
            <>
              {(items ?? []).length > 0 && (
                <ul className="mb-4 space-y-2">
                  {(items ?? []).map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-soft bg-card px-3 py-2">
                      <div className="min-w-0 text-sm text-ink">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-ink-2">
                          {' '}· {compact(s.metrics.impressions ?? 0)} impressions · {s.duration_label ?? '—'}
                          {s.location_label ? ` · ${s.location_label}` : ''}
                          {s.video_url ? ` · ${s.video_kind === 'youtube' ? 'YouTube' : 'video'}` : ' · no footage'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => startEdit(s)} className="text-xs text-rust hover:text-rust-dark">
                          Edit
                        </button>
                        <button onClick={() => remove(s.id)} className="text-xs text-danger hover:opacity-80">
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* form */}
              {editingId && (
                <p className="mb-2 text-xs font-medium text-rust">Editing “{name}” — save below or cancel.</p>
              )}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name — e.g. Pylon · SoMa pilot" className={inputCls} />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location — e.g. SoMa, San Francisco" className={inputCls} />
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls}>
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.label} value={d.label}>{d.label}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    value={videoKind === 'file' && videoUrl ? '(uploaded video)' : videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      setVideoKind('youtube');
                    }}
                    placeholder="YouTube link (optional)"
                    className={`${inputCls} min-w-0 flex-1`}
                    disabled={videoKind === 'file' && !!videoUrl}
                  />
                  <label className={`shrink-0 cursor-pointer rounded-md border border-border-soft px-3 py-2 text-sm text-ink hover:bg-card ${uploading ? 'opacity-60' : ''}`}>
                    {uploading ? 'Uploading…' : videoKind === 'file' && videoUrl ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* editable metrics */}
              {name.trim() && (
                <div className="mt-3 rounded-md border border-border-soft bg-card p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-2">
                      Metrics — edit any number{rate != null ? ` · attention rate ${rate}%` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTouched(false);
                        setDraft(toDraft(name.trim(), location.trim(), duration));
                      }}
                      className="text-xs text-rust hover:text-rust-dark"
                    >
                      ↻ Regenerate
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                    {METRIC_FIELDS.map((f) => (
                      <div key={f.key}>
                        <label className={metricLabel}>{f.label}</label>
                        <input
                          type="number"
                          min="0"
                          step={f.step ?? '1'}
                          value={draft[f.key] ?? ''}
                          onChange={(e) => {
                            setTouched(true);
                            setDraft((d) => ({ ...d, [f.key]: e.target.value }));
                          }}
                          className={`${inputCls} w-full`}
                        />
                      </div>
                    ))}
                    <div>
                      <label className={metricLabel}>Peak window</label>
                      <input
                        value={draft.peak_window ?? ''}
                        onChange={(e) => {
                          setTouched(true);
                          setDraft((d) => ({ ...d, peak_window: e.target.value }));
                        }}
                        placeholder="e.g. 12 – 2p"
                        className={`${inputCls} w-full`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={busy || uploading || !name.trim()}
                  className="rounded-md bg-rust px-4 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
                >
                  {busy ? 'Saving…' : editingId ? 'Save changes' : '+ Add showcase campaign'}
                </button>
                {editingId && (
                  <button onClick={resetForm} disabled={busy} className="text-sm text-ink-2 hover:text-ink">
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
