'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  DURATION_OPTIONS,
  generateMetrics,
  youtubeEmbedUrl,
  compact,
  type ShowcaseCampaign,
} from '@/lib/showcase';

const inputCls =
  'rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust';

// Manage a prospect advertiser's showcase campaigns: footage (YouTube link or
// uploaded video) + processed interaction metrics. These render on the claim
// page as the "results" that invite the advertiser to claim the account.
export default function AdminShowcase({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ShowcaseCampaign[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoKind, setVideoKind] = useState<'youtube' | 'file'>('youtube');
  const [uploading, setUploading] = useState(false);
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState(DURATION_OPTIONS[0].label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = name.trim() ? generateMetrics(name.trim(), location.trim(), duration) : null;

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('kovio_admin_showcases', { p_org_id: orgId });
    setItems((data as ShowcaseCampaign[]) ?? []);
    setLoading(false);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) void load();
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

  async function add() {
    if (!name.trim()) return setError('Name the campaign.');
    if (videoKind === 'youtube' && videoUrl && !youtubeEmbedUrl(videoUrl))
      return setError('That doesn’t look like a YouTube link.');
    setBusy(true);
    setError('');
    const metrics = generateMetrics(name.trim(), location.trim(), duration);
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_add_showcase', {
      p_org_id: orgId,
      p_name: name.trim(),
      p_video_url: videoUrl.trim() || null,
      p_video_kind: videoKind,
      p_location: location.trim() || null,
      p_duration: duration,
      p_metrics: metrics,
    });
    setBusy(false);
    if (error) {
      setError('Could not add the campaign.');
      return;
    }
    setName('');
    setVideoUrl('');
    setLocation('');
    await load();
    router.refresh();
  }

  async function remove(id?: string) {
    if (!id) return;
    const supabase = createClient();
    await supabase.rpc('kovio_admin_delete_showcase', { p_id: id });
    await load();
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button onClick={toggle} className="text-sm text-rust transition-colors hover:text-rust-dark">
        {open ? 'Hide showcase campaigns ▴' : 'Showcase campaigns ▾'}
      </button>

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
                          {' '}· {compact(s.metrics.impressions)} impressions · {s.duration_label ?? '—'}
                          {s.location_label ? ` · ${s.location_label}` : ''}
                          {s.video_url ? ` · ${s.video_kind === 'youtube' ? 'YouTube' : 'video'}` : ' · no footage'}
                        </span>
                      </div>
                      <button onClick={() => remove(s.id)} className="text-xs text-danger hover:opacity-80">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* add form */}
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

              {preview && (
                <p className="mt-2 text-xs text-ink-2">
                  Processed preview: <span className="text-ink">{compact(preview.impressions)} impressions</span> ·{' '}
                  {compact(preview.attended)} verified looks ({Math.round(preview.attention_rate * 100)}%) ·{' '}
                  {preview.avg_dwell_s}s avg dwell · peak {preview.peak_window}
                </p>
              )}
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
              <button
                onClick={add}
                disabled={busy || uploading || !name.trim()}
                className="mt-3 rounded-md bg-rust px-4 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
              >
                {busy ? 'Adding…' : '+ Add showcase campaign'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
