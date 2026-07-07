// Shared types for custom-campaign offers (advertiser -> OEM brokering + counter).
// Pure/isomorphic — safe to import from server components, client islands, and
// route handlers alike. All DB access goes through the SECURITY DEFINER RPCs in
// supabase/migrations/20260706_campaign_offers.sql + _offer_terms_counter.sql.

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered';

// One row of the OEM directory (an OEM org, optionally with one of its fleets).
export interface OemDirectoryRow {
  oem_org_id: string;
  oem_name: string;
  fleet_id: string | null;
  fleet_name: string | null;
  region: string | null;
}

// An exact operator location: geocoded label + coordinates. Legacy free-text
// entries have null coords (map falls back to a name search).
export interface GeoPoint {
  label: string;
  lat: number | null;
  lng: number | null;
}

// Terms an operator publishes (one set per operator). Drives the options an
// advertiser sees when they choose that operator on /campaigns/place.
export interface OemTerms {
  price_cents: number;
  price_unit: 'per_day' | 'flat';
  time_windows: string[];
  locations: string[];
  locations_geo: GeoPoint[];
  available_from: string | null;
  available_to: string | null;
  min_days: number | null;
  note: string | null;
}

// Preset dayparting windows an operator can offer.
export const TIME_WINDOW_OPTIONS = ['Mornings 6–11', 'Midday 11–5', 'Evenings 5–9', 'Late 9–12', 'All day'];

// Operator window label → engine targeting rule (hour_of_day ranges).
export const WINDOW_RULES: Record<string, Record<string, unknown> | null> = {
  'Mornings 6–11': { field: 'hour_of_day', op: 'between', value: [6, 11] },
  'Midday 11–5': { field: 'hour_of_day', op: 'between', value: [11, 17] },
  'Evenings 5–9': { field: 'hour_of_day', op: 'between', value: [17, 21] },
  'Late 9–12': { field: 'hour_of_day', op: 'between', value: [21, 24] },
  'All day': null,
};

// The operator's own view of their settings (includes the receive toggle).
export interface MyOemTerms extends OemTerms {
  published: boolean;
}

// One comment on an offer (advertiser ↔ operator ↔ Kovio).
export interface OfferComment {
  id: string;
  author_role: 'advertiser' | 'operator' | 'kovio';
  body: string;
  created_at: string;
  is_me: boolean;
}

// The operator's proposed adjustments (stored as jsonb on the offer).
export interface CounterTerms {
  cpi_cents?: number | null;
  budget_cents?: number | null;
  start_at?: string | null;
  end_at?: string | null;
  time_window?: string | null;
  location_label?: string | null;
}

// The four negotiable terms, in a shape both the OEM editor and advertiser
// review can render.
export interface OfferTerms {
  cost_per_impression_cents: number | null;
  budget_total_cents: number;
  start_at: string | null;
  end_at: string | null;
  time_window: string | null;
  location_label: string | null;
}

// An advertiser's view of an offer they placed (with the operator's counter, if any).
export interface MyOffer {
  id: string;
  name: string;
  status: OfferStatus;
  decision_reason: string | null;
  oem_name: string;
  fleet_name: string | null;
  budget_total_cents: number;
  cost_per_impression_cents: number | null;
  created_at: string;
  decided_at: string | null;
  start_at: string | null;
  end_at: string | null;
  time_window: string | null;
  location_label: string | null;
  counter: CounterTerms | null;
  counter_note: string | null;
  advertiser_name: string;
  creative_url: string | null;
  creative_type: string | null;
}

// The OEM's full view of an incoming offer (everything needed to decide/counter).
export interface IncomingOffer {
  id: string;
  advertiser_name: string;
  name: string;
  creative_url: string | null;
  creative_type: string | null;
  category: string | null;
  targeting: Array<Record<string, unknown>>;
  budget_total_cents: number;
  cost_per_impression_cents: number | null;
  message: string | null;
  fleet_name: string | null;
  status: OfferStatus;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
  start_at: string | null;
  end_at: string | null;
  time_window: string | null;
  location_label: string | null;
  counter: CounterTerms | null;
  counter_note: string | null;
}

// Body accepted by POST /api/offers/place.
export interface PlaceOfferBody {
  targetOemId: string;
  targetFleetId?: string | null;
  name: string;
  advertiserName: string;
  creativeUrl?: string | null;
  creativeType?: string | null;
  category?: string | null;
  targeting?: Array<Record<string, unknown>>;
  budgetCents?: number;
  cpiCents?: number | null;
  message?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timeWindow?: string | null;
  locationLabel?: string | null;
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Inclusive day count for a start/end date range.
export function daysBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T00:00:00`).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86_400_000) + 1;
}

// Total the advertiser pays given operator terms + chosen day count.
export function totalCents(terms: Pick<OemTerms, 'price_cents' | 'price_unit'>, days: number): number {
  return terms.price_unit === 'flat' ? terms.price_cents : terms.price_cents * Math.max(1, days);
}

// "$500.00 / day" or "$500.00 flat"
export function priceLabel(terms: Pick<OemTerms, 'price_cents' | 'price_unit'>): string {
  return terms.price_unit === 'flat' ? `${usd(terms.price_cents)} flat` : `${usd(terms.price_cents)} / day`;
}

// "¢12.5 / impression" style label for a per-impression rate.
export function cpiLabel(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return `${cents}¢ / impression`;
}

// "Jul 8 – Aug 10, 2026" style date range from ISO date strings.
export function dateRange(start: string | null | undefined, end: string | null | undefined): string {
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return 'No fixed dates';
}

// Human-readable summary of a targeting rule array (best-effort).
export function summarizeTargeting(rules: Array<Record<string, unknown>>): string {
  if (!rules || rules.length === 0) return 'All times · anyone nearby';
  const parts = rules.map((r) => {
    const field = String(r.field ?? '');
    const op = String(r.op ?? '');
    const value = r.value;
    if (field === 'hour_of_day' && Array.isArray(value)) return `Hours ${value[0]}–${value[1]}`;
    if (field === 'person_count') return `Person watching (${op} ${value})`;
    return `${field} ${op} ${JSON.stringify(value)}`;
  });
  return parts.join(' · ');
}
