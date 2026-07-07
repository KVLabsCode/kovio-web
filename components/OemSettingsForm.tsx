'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DateField from '@/components/DateField';
import { dateRange, TIME_WINDOW_OPTIONS, type GeoPoint, type MyOemTerms } from '@/lib/offers';

// DateField skin matching this form's compact input style.
const dateFieldCls =
  'flex w-full items-center justify-between rounded-md border border-border-soft bg-card px-3 py-2.5 text-left text-sm text-ink outline-none transition-colors focus:border-rust';

// Free typeahead geocoder (Photon / OpenStreetMap) so locations are picked from
// real places with exact coordinates — no free typing. Labels are composed as
// "Place, City, State" (plus country outside the US). Swappable for Google
// Places Autocomplete once a NEXT_PUBLIC_GOOGLE_MAPS_API_KEY exists.
interface PhotonFeature {
  properties: {
    name?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
  geometry: { coordinates: [number, number] };
}

async function searchPlaces(q: string): Promise<GeoPoint[]> {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  const out: GeoPoint[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties ?? {};
    if (!p.name) continue;
    const label = [
      p.name,
      p.city && p.city !== p.name ? p.city : null,
      p.state && p.state !== p.name ? p.state : null,
      p.countrycode?.toUpperCase() !== 'US' ? p.country : null,
    ]
      .filter(Boolean)
      .join(', ');
    if (!label || seen.has(label)) continue; // collapse duplicate places
    seen.add(label);
    out.push({ label, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });
    if (out.length >= 5) break;
  }
  return out;
}

// Legacy rows may have labels without coordinates — carry them as GeoPoints.
function initGeo(initial: MyOemTerms | null): GeoPoint[] {
  if (initial?.locations_geo?.length) return initial.locations_geo;
  return (initial?.locations ?? []).map((label) => ({ label, lat: null, lng: null }));
}

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
  const [geo, setGeo] = useState<GeoPoint[]>(() => initGeo(initial));
  const [locInput, setLocInput] = useState('');
  const [suggestions, setSuggestions] = useState<GeoPoint[]>([]);
  const [searching, setSearching] = useState(false);
  // Which location the coverage map is focused on (chips act as the filter).
  const [focusedLoc, setFocusedLoc] = useState<string>(() => initGeo(initial)[0]?.label ?? '');
  const [availFrom, setAvailFrom] = useState(initial?.available_from ?? '');
  const [availTo, setAvailTo] = useState(initial?.available_to ?? '');
  const [note, setNote] = useState(initial?.note ?? '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function toggleWindow(w: string) {
    setWindows((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));
  }
  // Debounced place search — suggestions only; nothing is added by free typing.
  useEffect(() => {
    const q = locInput.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchPlaces(q);
        setSuggestions(found);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [locInput]);

  function addPlace(p: GeoPoint) {
    if (!geo.some((g) => g.label === p.label)) setGeo((prev) => [...prev, p]);
    setFocusedLoc(p.label); // jump the map to what was just added
    setLocInput('');
    setSuggestions([]);
  }

  function removePlace(label: string) {
    setGeo((prev) => {
      const next = prev.filter((g) => g.label !== label);
      if (focusedLoc === label) setFocusedLoc(next[0]?.label ?? '');
      return next;
    });
  }

  const focused = geo.find((g) => g.label === focusedLoc) ?? null;
  // Exact pin when we have coordinates; name search for legacy label-only rows.
  const mapQuery = focused
    ? focused.lat != null && focused.lng != null
      ? `${focused.lat},${focused.lng}`
      : focused.label
    : '';

  async function save() {
    setError('');
    if (accepting && windows.length === 0) return setError('Offer at least one time window.');
    setSaving(true);
    const supabase = createClient();
    const shared = {
      p_price_cents: Math.max(0, Math.round(parseFloat(priceUsd || '0') * 100)),
      p_price_unit: priceUnit,
      p_time_windows: windows,
      p_locations: geo.map((g) => g.label),
      p_locations_geo: geo,
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
          {/* Select-only: type to search real places, pick from suggestions. */}
          <div className="relative">
            <input
              value={locInput}
              onChange={(e) => setLocInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestions[0]) addPlace(suggestions[0]);
                }
              }}
              placeholder="Search a place — e.g. Union Square, San Francisco"
              className={inputCls}
              role="combobox"
              aria-expanded={suggestions.length > 0}
            />
            {(suggestions.length > 0 || searching) && locInput.trim().length >= 3 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border-soft bg-card shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
                {searching && suggestions.length === 0 ? (
                  <div className="px-3 py-2.5 text-sm text-ink-3">Searching…</div>
                ) : (
                  suggestions.map((s) => (
                    <button
                      key={`${s.label}-${s.lat}`}
                      type="button"
                      onClick={() => addPlace(s)}
                      className="block w-full px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-page"
                    >
                      📍 {s.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            Pick from the suggestions — each location is a real place with exact coordinates.
          </p>

          {geo.length > 0 && (
            <>
              {/* Chips double as the map filter — click one to focus it below. */}
              <div className="mt-2 flex flex-wrap gap-2">
                {geo.map((g) => (
                  <span
                    key={g.label}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      focusedLoc === g.label
                        ? 'border-rust bg-rust/10 text-rust'
                        : 'border-transparent bg-page text-ink'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setFocusedLoc(g.label)}
                      className="transition-opacity hover:opacity-80"
                      aria-label={`Show ${g.label} on the map`}
                    >
                      {g.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePlace(g.label)}
                      className="text-ink-3 hover:text-danger"
                      aria-label={`Remove ${g.label}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              {/* Coverage map — Google Maps embed pinned to the exact coordinates. */}
              {focused && (
                <div className="mt-3 overflow-hidden rounded-lg border border-border-soft">
                  <iframe
                    key={mapQuery}
                    title={`Map of ${focused.label}`}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${focused.lat != null ? 15 : 11}&output=embed`}
                    className="h-64 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="flex items-center justify-between bg-page px-3 py-2">
                    <span className="text-xs text-ink-2">
                      Showing <span className="text-ink">{focused.label}</span>
                      {focused.lat != null ? ' (exact pin)' : ''} — click a location above to switch.
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(mapQuery)}`}
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
            <DateField value={availFrom} onChange={setAvailFrom} max={availTo || undefined} placeholder="Open-ended" className={dateFieldCls} />
          </div>
          <div>
            <label className={labelCls}>Available to</label>
            <DateField value={availTo} onChange={setAvailTo} min={availFrom || undefined} placeholder="Open-ended" className={dateFieldCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Note to Kovio &amp; advertisers (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to know before routing campaigns to you." className={inputCls} />
        </div>

        <p className="text-xs text-ink-3">
          Availability preview: {dateRange(availFrom || null, availTo || null)} ·{' '}
          {windows.length ? windows.join(' · ') : 'no windows'} ·{' '}
          {geo.length ? geo.map((g) => g.label).join(', ') : 'anywhere your fleet runs'}
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
