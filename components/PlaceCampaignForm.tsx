'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { OemDirectoryRow, PlaceOfferBody } from '@/lib/offers';

const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;

const PRESETS: Record<string, Record<string, unknown>> = {
  morning: { field: 'hour_of_day', op: 'between', value: [6, 11] },
  evening: { field: 'hour_of_day', op: 'between', value: [17, 21] },
  person_watching: { field: 'person_count', op: '>=', value: 1 },
};

const inputCls =
  'w-full rounded-[11px] border border-line bg-field px-[15px] py-[13px] text-[15px] text-ink outline-none transition-colors focus:border-accent';
const labelCls = 'mb-2 block text-[14px] font-semibold text-ink';
const sectionCls = 'font-mono text-[12px] uppercase tracking-[0.14em] text-faint';

interface OemGroup {
  id: string;
  name: string;
  fleets: Array<{ id: string; name: string; region: string | null }>;
}

export default function PlaceCampaignForm() {
  const [dir, setDir] = useState<OemDirectoryRow[]>([]);
  const [dirLoading, setDirLoading] = useState(true);

  const [oemId, setOemId] = useState('');
  const [fleetId, setFleetId] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [creativeUrl, setCreativeUrl] = useState('');
  const [creativeType, setCreativeType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('brand');
  const [presets, setPresets] = useState<Record<string, boolean>>({ morning: false, evening: false, person_watching: false });
  const [budgetUsd, setBudgetUsd] = useState('250');
  const [cpiCents, setCpiCents] = useState('');
  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ emailed: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc('kovio_oem_directory');
      if (alive) {
        setDir((data as OemDirectoryRow[]) ?? []);
        setDirLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Group the flat directory rows into OEM -> fleets.
  const groups = useMemo<OemGroup[]>(() => {
    const map = new Map<string, OemGroup>();
    for (const r of dir) {
      let g = map.get(r.oem_org_id);
      if (!g) {
        g = { id: r.oem_org_id, name: r.oem_name, fleets: [] };
        map.set(r.oem_org_id, g);
      }
      if (r.fleet_id) g.fleets.push({ id: r.fleet_id, name: r.fleet_name ?? 'Fleet', region: r.region });
    }
    return [...map.values()];
  }, [dir]);

  const selectedOem = groups.find((g) => g.id === oemId);

  async function handleFile(file: File) {
    const isVid = file.type.startsWith('video');
    const isImg = file.type.startsWith('image');
    if (!isVid && !isImg) return setError('Only images and video are supported.');
    if (isImg && file.size > IMAGE_MAX) return setError('Image is over the 8 MB limit.');
    if (isVid && file.size > VIDEO_MAX) return setError('Video is over the 50 MB limit.');
    setError('');
    setUploading(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `offers/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from('creatives').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        setError(upErr.message || 'Upload failed.');
        return;
      }
      const { data } = supabase.storage.from('creatives').getPublicUrl(path);
      setCreativeUrl(data.publicUrl);
      setCreativeType(isVid ? 'video' : 'image');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oemId) return setError('Choose a fleet operator to place with.');
    if (!name.trim()) return setError('Give the campaign a name.');
    if (!creativeUrl) return setError('Add a creative — upload an image or video, or paste a URL.');
    setLoading(true);
    setError('');

    const targeting = Object.entries(presets)
      .filter(([, on]) => on)
      .map(([k]) => PRESETS[k]);

    const body: PlaceOfferBody = {
      targetOemId: oemId,
      targetFleetId: fleetId || null,
      name: name.trim(),
      advertiserName: brand.trim(),
      creativeUrl,
      creativeType,
      category,
      targeting,
      budgetCents: Math.round(parseFloat(budgetUsd || '0') * 100),
      cpiCents: cpiCents ? parseFloat(cpiCents) : null,
      message: message.trim() || null,
    };

    const res = await fetch('/api/offers/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? 'Could not place the campaign.');
      return;
    }
    setDone({ emailed: !!json.emailed });
  }

  if (done) {
    return (
      <div className="mt-8 max-w-2xl rounded-[16px] border border-line bg-panel p-8">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] bg-tint">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m4 12 5 5 11-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-dark" />
          </svg>
        </div>
        <h2 className="mt-5 font-serif text-[30px] font-medium text-ink">Sent to {selectedOem?.name ?? 'the operator'}.</h2>
        <p className="mt-2 text-[16px] text-muted">
          Your custom campaign is now in their review queue. {done.emailed ? 'We emailed them a heads-up.' : ''} You’ll
          hear back once they accept or reject it.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/campaigns" className="rounded-[11px] bg-accent px-5 py-3 text-[15px] text-white transition-colors hover:bg-accent-dark">
            Back to campaigns
          </Link>
          <button
            onClick={() => {
              setDone(null);
              setName('');
              setCreativeUrl('');
              setMessage('');
            }}
            className="rounded-[11px] border border-line-strong px-5 py-3 text-[15px] text-ink transition-colors hover:border-accent"
          >
            Place another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      {/* LEFT: form */}
      <div className="max-w-2xl rounded-[16px] border border-line bg-panel p-6">
        <div className={sectionCls}>Fleet operator</div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Place with</label>
            <select
              value={oemId}
              onChange={(e) => {
                setOemId(e.target.value);
                setFleetId('');
              }}
              className={inputCls}
              disabled={dirLoading}
            >
              <option value="">{dirLoading ? 'Loading operators…' : 'Choose an operator'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Fleet (optional)</label>
            <select
              value={fleetId}
              onChange={(e) => setFleetId(e.target.value)}
              className={inputCls}
              disabled={!selectedOem || selectedOem.fleets.length === 0}
            >
              <option value="">Any fleet</option>
              {selectedOem?.fleets.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.region ? ` · ${f.region}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="my-6 border-t border-dashed border-line" />
        <div className={sectionCls}>Campaign</div>
        <div className="mt-3 space-y-4">
          <div>
            <label className={labelCls}>Campaign name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Spring launch — SF" required />
          </div>
          <div>
            <label className={labelCls}>Brand / advertiser</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} placeholder="Shown to the operator" />
          </div>
          <div>
            <label className={labelCls}>Creative</label>
            {creativeUrl ? (
              <div className="flex items-center gap-3 rounded-[11px] border border-line bg-field p-3">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-black">
                  {creativeType === 'video' ? (
                    <video src={creativeUrl} muted className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={creativeUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 truncate text-[13px] text-muted">{creativeUrl.split('/').pop()}</div>
                <button type="button" onClick={() => setCreativeUrl('')} className="text-[13px] text-accent-dark hover:text-accent">
                  Replace
                </button>
              </div>
            ) : (
              <>
                <label className={`inline-flex cursor-pointer items-center rounded-[11px] border border-line-strong px-4 py-3 text-[15px] text-ink transition-colors hover:border-accent ${uploading ? 'opacity-60' : ''}`}>
                  {uploading ? 'Uploading…' : 'Upload image or video'}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                <input
                  type="url"
                  placeholder="…or paste a creative URL"
                  onChange={(e) => {
                    setCreativeUrl(e.target.value);
                    setCreativeType(/\.(mp4|webm|mov)(\?|$)/i.test(e.target.value) ? 'video' : 'image');
                  }}
                  className={`${inputCls} mt-2`}
                />
              </>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {['brand', 'food', 'retail', 'event', 'other'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Budget (USD)</label>
              <input type="number" min="0" step="1" value={budgetUsd} onChange={(e) => setBudgetUsd(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <div className={labelCls}>When to run</div>
            <div className="flex flex-wrap gap-2">
              {[
                ['morning', 'Mornings 6–11'],
                ['evening', 'Evenings 5–9'],
                ['person_watching', 'Only when watched'],
              ].map(([k, label]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setPresets((p) => ({ ...p, [k]: !p[k] }))}
                  className={`rounded-full border px-4 py-2 text-[14px] transition-colors ${
                    presets[k] ? 'border-accent bg-tint text-accent-dark' : 'border-line-strong text-ink hover:border-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Message to the operator (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Anything they should know about the brand or creative."
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || uploading}
            className="rounded-[11px] bg-accent px-6 py-[13px] text-[15px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
          >
            {loading ? 'Placing…' : 'Place campaign →'}
          </button>
          <Link href="/campaigns" className="text-[15px] text-muted transition-colors hover:text-ink">
            Cancel
          </Link>
        </div>
      </div>

      {/* RIGHT: explainer */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-[16px] bg-tint p-6">
          <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-accent-dark">How it works</div>
          <ol className="mt-4 space-y-3 text-[14px] text-ink">
            <li><span className="font-semibold">1.</span> You place a custom campaign with a fleet operator.</li>
            <li><span className="font-semibold">2.</span> They review the creative and content, then accept or reject.</li>
            <li><span className="font-semibold">3.</span> On accept, it’s cleared to run on their robots — you’re notified either way.</li>
          </ol>
          <p className="mt-4 text-[13px] text-muted">
            Operators approve content before it runs on their fleet. Nothing goes live without their yes.
          </p>
        </div>
      </aside>
    </form>
  );
}
