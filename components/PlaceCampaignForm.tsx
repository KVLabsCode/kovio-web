'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import {
  daysBetween,
  totalCents,
  priceLabel,
  usd,
  dateRange,
  WINDOW_RULES,
  type OemTerms,
  type PlaceOfferBody,
} from '@/lib/offers';

const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;

const PRESETS: Record<string, Record<string, unknown>> = {
  morning: { field: 'hour_of_day', op: 'between', value: [6, 11] },
  evening: { field: 'hour_of_day', op: 'between', value: [17, 21] },
  person_watching: { field: 'person_count', op: '>=', value: 1 },
};
const TIME_LABELS: Record<string, string> = {
  morning: 'Mornings 6–11',
  evening: 'Evenings 5–9',
  person_watching: 'Only when watched',
};

const inputCls =
  'w-full rounded-[11px] border border-line bg-field px-[15px] py-[13px] text-[15px] text-ink outline-none transition-colors focus:border-accent';
const labelCls = 'mb-2 block text-[14px] font-semibold text-ink';
const sectionCls = 'font-mono text-[12px] uppercase tracking-[0.14em] text-faint';

type Target = { oem_org_id: string; oem_name: string; link: string };

export default function PlaceCampaignForm() {
  const [target, setTarget] = useState<Target | null>(null);
  // The operator's published campaign settings — THE price. No advertiser-set
  // budgets: the charge is computed from these terms and the chosen dates.
  const [terms, setTerms] = useState<OemTerms | null>(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [creativeUrl, setCreativeUrl] = useState('');
  const [creativeType, setCreativeType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('brand');
  const [presets, setPresets] = useState<Record<string, boolean>>({ morning: false, evening: false, person_watching: false });
  // Advertiser's picks WITHIN the operator's published options.
  const [selWindows, setSelWindows] = useState<string[]>([]);
  const [selLocs, setSelLocs] = useState<string[]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // '' = not done · 'paying' = redirecting to Stripe · 'done' = submitted
  // (payment deferred, e.g. zero budget or checkout unavailable)
  const [done, setDone] = useState<'' | 'paying' | 'done'>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc('kovio_place_target');
      const row = Array.isArray(data) ? data[0] : data;
      if (!alive || !row) return;
      setTarget(row as Target);
      const { data: t } = await supabase.rpc('kovio_oem_terms', { p_oem_org_id: (row as Target).oem_org_id });
      const termsRow = Array.isArray(t) ? t[0] : t;
      if (alive && termsRow) {
        const tr = termsRow as OemTerms;
        setTerms(tr);
        // Default to everything the operator offers — the advertiser narrows down.
        setSelWindows(tr.time_windows ?? []);
        setSelLocs(tr.locations ?? []);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Set price, straight from the operator's terms + the chosen dates.
  const days = daysBetween(startAt || null, endAt || null);
  const total = terms ? (terms.price_unit === 'flat' ? terms.price_cents : totalCents(terms, days)) : 0;
  const perDay = terms?.price_unit === 'per_day';
  const minDays = terms?.min_days ?? 1;

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
    if (!target) return setError('The fleet is still loading — one moment.');
    if (!name.trim()) return setError('Give the campaign a name.');
    if (!creativeUrl) return setError('Add a creative — upload an image or video.');
    // Everything must fit within the operator's published options.
    if (terms) {
      if (perDay && (!startAt || !endAt)) return setError('Pick your start and end dates — pricing is per day.');
      if (perDay && days < minDays) return setError(`This fleet has a ${minDays}-day minimum.`);
      if (terms.available_from && startAt && startAt < terms.available_from)
        return setError(`This fleet is available ${dateRange(terms.available_from, terms.available_to)}.`);
      if (terms.available_to && endAt && endAt > terms.available_to)
        return setError(`This fleet is available ${dateRange(terms.available_from, terms.available_to)}.`);
      if (terms.time_windows.length > 0 && selWindows.length === 0)
        return setError('Pick at least one time window.');
      if (terms.locations.length > 0 && selLocs.length === 0)
        return setError('Pick at least one location.');
    }
    setLoading(true);
    setError('');

    // Time + targeting come from the operator's published options when they
    // exist; otherwise the generic presets.
    let targeting: Array<Record<string, unknown>>;
    let timeWindow: string;
    if (terms && terms.time_windows.length > 0) {
      targeting = selWindows
        .map((w) => WINDOW_RULES[w])
        .filter((r): r is Record<string, unknown> => r != null);
      timeWindow = selWindows.join(' · ');
    } else {
      const on = Object.entries(presets).filter(([, v]) => v).map(([k]) => k);
      targeting = on.map((k) => PRESETS[k]);
      timeWindow = on.length ? on.map((k) => TIME_LABELS[k]).join(' · ') : 'All day';
    }

    const body: PlaceOfferBody = {
      targetOemId: target.oem_org_id,
      targetFleetId: null,
      name: name.trim(),
      advertiserName: brand.trim(),
      creativeUrl,
      creativeType,
      category,
      targeting,
      // The set price from the operator's terms — not an advertiser-chosen budget.
      budgetCents: total,
      cpiCents: null,
      startAt: startAt || null,
      endAt: endAt || null,
      timeWindow,
      locationLabel:
        terms && terms.locations.length > 0 && selLocs.length > 0
          ? selLocs.join(' · ')
          : target.oem_name,
      message: message.trim() || null,
    };

    const res = await fetch('/api/offers/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(json.error ?? 'Could not place the campaign.');
      return;
    }

    // Campaign submitted — collect the set price via Stripe Checkout. The offer
    // is already recorded, so a canceled/failed payment never loses the campaign.
    if (total > 0) {
      setDone('paying');
      const co = await apiClient.checkout(total, {
        success_path: '/campaigns?paid=1',
        cancel_path: '/campaigns?payment=canceled',
      });
      if (co.data?.url) {
        window.location.assign(co.data.url);
        return; // navigating away to Stripe
      }
    }
    setLoading(false);
    setDone('done');
  }

  if (done === 'paying') {
    return (
      <div className="mt-8 max-w-2xl rounded-[16px] border border-line bg-panel p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <h2 className="mt-5 font-serif text-[30px] font-medium text-ink">Campaign submitted — taking you to payment.</h2>
        <p className="mt-2 text-[16px] text-muted">
          One moment, we’re opening secure Stripe Checkout to fund your budget…
        </p>
      </div>
    );
  }

  if (done === 'done') {
    return (
      <div className="mt-8 max-w-2xl rounded-[16px] border border-line bg-panel p-8">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] bg-tint">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m4 12 5 5 11-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-dark" />
          </svg>
        </div>
        <h2 className="mt-5 font-serif text-[30px] font-medium text-ink">Campaign submitted.</h2>
        <p className="mt-2 text-[16px] text-muted">
          Your campaign was sent to {target?.oem_name ?? 'the fleet'} for review. Track its status any time under
          Campaigns — you’ll hear back once it’s approved.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/campaigns" className="rounded-[11px] bg-accent px-5 py-3 text-[15px] text-white transition-colors hover:bg-accent-dark">
            View your campaigns
          </Link>
          <button
            onClick={() => {
              setDone('');
              setName('');
              setCreativeUrl('');
              setMessage('');
            }}
            className="rounded-[11px] border border-line-strong px-5 py-3 text-[15px] text-ink transition-colors hover:border-accent"
          >
            Start another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div className="max-w-2xl rounded-[16px] border border-line bg-panel p-6">
        {/* Destination */}
        <div className={sectionCls}>Fleet</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[12px] border-2 border-accent bg-tint p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Robot.com</span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white">Live</span>
            </div>
            <p className="mt-1.5 text-[13px] text-muted">Humanoid robots on real streets.</p>
            {terms?.note && <p className="mt-1 text-[13px] italic text-muted">“{terms.note}”</p>}
            {target?.link && (
              <a href={target.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-[13px] text-accent-dark hover:text-accent">
                robot.com ↗
              </a>
            )}
          </div>
          <div className="rounded-[12px] border border-dashed border-line-strong p-4 opacity-70">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Kovio&apos;s Fleet</span>
              <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-muted">Coming soon</span>
            </div>
            <p className="mt-1.5 text-[13px] text-muted">Kovio’s own robots — not yet available.</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Start date</label>
              <input
                type="date"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                min={terms?.available_from ?? undefined}
                max={terms?.available_to ?? undefined}
                className={inputCls}
                required={!!terms && perDay}
              />
            </div>
            <div>
              <label className={labelCls}>End date</label>
              <input
                type="date"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                min={startAt || terms?.available_from || undefined}
                max={terms?.available_to ?? undefined}
                className={inputCls}
                required={!!terms && perDay}
              />
            </div>
          </div>
          {terms && (terms.available_from || terms.available_to) && (
            <p className="-mt-2 text-[13px] text-muted">
              This fleet is available {dateRange(terms.available_from, terms.available_to)}.
            </p>
          )}

          {/* Set price — comes from the operator's campaign settings, not an input. */}
          {terms ? (
            <div className="rounded-[12px] bg-tint p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent-dark">Price</div>
                <div className="text-[13px] text-muted">{priceLabel(terms)}{perDay && minDays > 1 ? ` · ${minDays}-day minimum` : ''}</div>
              </div>
              <div className="mt-1 text-[26px] font-medium text-ink">
                {perDay
                  ? days > 0
                    ? `${usd(total)} `
                    : '— '
                  : `${usd(total)} `}
                {perDay && days > 0 && (
                  <span className="text-[14px] font-normal text-muted">
                    ({usd(terms.price_cents)} × {days} day{days === 1 ? '' : 's'})
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {perDay && days === 0
                  ? 'Pick your start and end dates to see the total.'
                  : 'Charged once via secure Stripe Checkout when you submit.'}
              </p>
            </div>
          ) : (
            <div className="rounded-[12px] border border-dashed border-line-strong p-4 text-[13px] text-muted">
              Pricing for this fleet is being finalized — submit your campaign and Kovio will confirm the
              price with you before anything runs.
            </div>
          )}
          <div>
            <div className={labelCls}>When to run</div>
            {terms && terms.time_windows.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {terms.time_windows.map((w) => (
                    <button
                      type="button"
                      key={w}
                      onClick={() =>
                        setSelWindows((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]))
                      }
                      className={`rounded-full border px-4 py-2 text-[14px] transition-colors ${
                        selWindows.includes(w) ? 'border-accent bg-tint text-accent-dark' : 'border-line-strong text-ink hover:border-accent'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[13px] text-muted">These are the windows this fleet runs campaigns.</p>
              </>
            ) : (
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
            )}
          </div>
          {terms && terms.locations.length > 0 && (
            <div>
              <div className={labelCls}>Where it runs</div>
              <div className="flex flex-wrap gap-2">
                {terms.locations.map((l) => (
                  <button
                    type="button"
                    key={l}
                    onClick={() =>
                      setSelLocs((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]))
                    }
                    className={`rounded-full border px-4 py-2 text-[14px] transition-colors ${
                      selLocs.includes(l) ? 'border-accent bg-tint text-accent-dark' : 'border-line-strong text-ink hover:border-accent'
                    }`}
                  >
                    📍 {l}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[13px] text-muted">The fleet’s coverage — pick where your campaign runs.</p>
            </div>
          )}
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
            disabled={loading || uploading || !target}
            className="rounded-[11px] bg-accent px-6 py-[13px] text-[15px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
          >
            {loading ? 'Submitting…' : total > 0 ? `Submit & pay ${usd(total)} →` : 'Submit campaign →'}
          </button>
          <Link href="/campaigns" className="text-[15px] text-muted transition-colors hover:text-ink">
            Cancel
          </Link>
        </div>
      </div>

      {/* Explainer */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-[16px] bg-tint p-6">
          <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-accent-dark">How it works</div>
          <ol className="mt-4 space-y-3 text-[14px] text-ink">
            <li><span className="font-semibold">1.</span> Submit your campaign and fund the budget with secure Stripe Checkout.</li>
            <li><span className="font-semibold">2.</span> Kovio and the operator review the creative and content.</li>
            <li><span className="font-semibold">3.</span> Once approved it runs on real robots — track status under Campaigns.</li>
          </ol>
          <p className="mt-4 text-[13px] text-muted">
            More fleets are coming to Kovio soon. For now, campaigns run on the Robot.com fleet.
          </p>
        </div>
      </aside>
    </form>
  );
}
