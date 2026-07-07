'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { dateRange, TIME_WINDOW_OPTIONS, type MyOemTerms } from '@/lib/offers';

const inputCls =
  'w-full rounded-md border border-border-soft bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-rust';
const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-2';

// Campaign-receiving settings for a fleet operator. Also powers the admin's
// "edit any operator" view: pass `adminOrgId` and saves go through the
// admin RPC instead of the operator's own.
export default function OemSettingsForm({
  initial,
  adminOrgId,
}: {
  initial: MyOemTerms | null;
  adminOrgId?: string;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(initial?.published ?? false);
  const [priceUsd, setPriceUsd] = useState(initial?.price_cents ? (initial.price_cents / 100).toString() : '500');
  const [priceUnit, setPriceUnit] = useState<'per_day' | 'flat'>(initial?.price_unit ?? 'per_day');
  const [minDays, setMinDays] = useState(initial?.min_days?.toString() ?? '');
  const [windows, setWindows] = useState<string[]>(initial?.time_windows?.length ? initial.time_windows : ['All day']);
  const [locations, setLocations] = useState<string[]>(initial?.locations ?? []);
  const [locInput, setLocInput] = useState('');
  // Which location the coverage map is focused on (chips act as the filter).
  const [focusedLoc, setFocusedLoc] = useState<string>(initial?.locations?.[0] ?? '');
  const [availFrom, setAvailFrom] = useState(initial?.available_from ?? '');
  const [availTo, setAvailTo] = useState(initial?.available_to ?? '');
  const [note, setNote] = useState(initial?.note ?? '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function toggleWindow(w: string) {
    setWindows((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }
  function addLocation() {
    const v = locInput.trim();
    if (v && !locations.includes(v)) {
      setLocations((p) => [...p, v]);
      setFocusedLoc(v); // jump the map to what was just added
    }
    setLocInput('');
  }

  function removeLocation(l: string) {
    setLocations((p) => {
      const next = p.filter((x) => x !== l);
      if (focusedLoc === l) setFocusedLoc(next[0] ?? '');
      return next;
    });
  }

  async function save() {
    setError('');
    if (accepting && windows.length === 0) return setError('Offer at least one time window.');
    setSaving(true);
    const supabase = createClient();
    const shared = {
      p_price_cents: Math.max(0, Math.round(parseFloat(priceUsd || '0') * 100)),
      p_price_unit: priceUnit,
      p_time_windows: windows,
      p_locations: locations,
      p_available_from: availFrom || null,
      p_available_to: availTo || null,
      p_min_days: minDays ? parseInt(minDays, 10) : null,
      p_note: note.trim() || null,
      p_published: accepting,
    };
    const { error } = adminOrgId
      ? await supabase.rpc('kovio_admin_set_oem_terms', { p_org_id: adminOrgId, ...shared })
      : await supabase.rpc('kovio_set_oem_terms', shared);
    setSaving(false);
    if (error) {
      setError(error.message || 'Could not save the settings.');
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="rounded-lg border border-border-soft bg-card p-6">
      {/* Receive toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-medium text-ink">Receive custom campaigns</div>
          <p className="mt-1 max-w-md text-sm text-ink-2">
            When on, Kovio can route advertiser campaigns to your fleet. Each one still lands in your
            Campaigns tab for you to accept, reschedule, or reject.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={accepting}
          onClick={() => setAccepting((v) => !v)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${accepting ? 'bg-rust' : 'bg-border-mid'}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${accepting ? 'left-6' : 'left-1'}`}
          />
        </button>
      </div>

      <div className={`mt-6 space-y-5 border-t border-border-soft pt-6 ${accepting ? '' : 'pointer-events-none opacity-50'}`}>
        {/* Pricing — this is the set price advertisers pay at submission. */}
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Campaign price (USD)</label>
            <input type="number" min="0" step="1" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Charged</label>
            <div className="flex gap-2">
              {(['per_day', 'flat'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setPriceUnit(u)}
                  className={`flex-1 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    priceUnit === u ? 'border-rust bg-rust/10 text-rust' : 'border-border-soft text-ink hover:border-rust'
                  }`}
                >
                  {u === 'per_day' ? 'Per day' : 'Flat / campaign'}
                </button>
              ))}
            </div>
          </div>
          {priceUnit === 'per_day' && (
            <div>
              <label className={labelCls}>Min days</label>
              <input type="number" min="1" value={minDays} onChange={(e) => setMinDays(e.target.value)} placeholder="—" className={inputCls} />
            </div>
          )}
        </div>
        <p className="-mt-2 text-xs text-ink-3">
          Advertisers pay this exact price when they submit a campaign — {priceUnit === 'per_day' ? 'price × campaign days' : 'one flat charge'}.
        </p>

        <div>
          <label className={labelCls}>Time windows you'll run campaigns</label>
          <div className="flex flex-wrap gap-2">
            {TIME_WINDOW_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => toggleWindow(w)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  windows.includes(w) ? 'border-rust bg-rust/10 text-rust' : 'border-border-soft text-ink hover:border-rust'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Locations your robots cover</label>
          <div className="flex gap-2">
            <input
              value={locInput}
              onChange={(e) => setLocInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLocation();
                }
              }}
              placeholder="e.g. San Francisco"
              className={inputCls}
            />
            <button type="button" onClick={addLocation} className="shrink-0 rounded-md border border-border-soft px-4 text-sm text-ink hover:border-rust">
              Add
            </button>
          </div>
          {locations.length > 0 && (
            <>
              {/* Chips double as the map filter — click one to focus it below. */}
              <div className="mt-2 flex flex-wrap gap-2">
                {locations.map((l) => (
                  <span
                    key={l}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      focusedLoc === l
                        ? 'border-rust bg-rust/10 text-rust'
                        : 'border-transparent bg-page text-ink'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setFocusedLoc(l)}
                      className="transition-opacity hover:opacity-80"
                      aria-label={`Show ${l} on the map`}
                    >
                      {l}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLocation(l)}
                      className="text-ink-3 hover:text-danger"
                      aria-label={`Remove ${l}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              {/* Coverage map — keyless Google Maps embed of the focused location. */}
              {focusedLoc && (
                <div className="mt-3 overflow-hidden rounded-lg border border-border-soft">
                  <iframe
                    key={focusedLoc}
                    title={`Map of ${focusedLoc}`}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(focusedLoc)}&z=11&output=embed`}
                    className="h-64 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="flex items-center justify-between bg-page px-3 py-2">
                    <span className="text-xs text-ink-2">
                      Showing <span className="text-ink">{focusedLoc}</span> — click a location above to switch.
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(focusedLoc)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-ink-2 transition-colors hover:text-ink"
                    >
                      Open in Google Maps ↗
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Available from</label>
            <input type="date" value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Available to</label>
            <input type="date" value={availTo} onChange={(e) => setAvailTo(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Note to Kovio &amp; advertisers (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to know before routing campaigns to you." className={inputCls} />
        </div>

        <p className="text-xs text-ink-3">
          Availability preview: {dateRange(availFrom || null, availTo || null)} ·{' '}
          {windows.length ? windows.join(' · ') : 'no windows'} ·{' '}
          {locations.length ? locations.join(', ') : 'anywhere your fleet runs'}
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-md bg-rust px-5 py-2.5 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-50">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-rust">Saved.</span>}
      </div>
    </div>
  );
}
