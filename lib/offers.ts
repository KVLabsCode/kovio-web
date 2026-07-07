// Shared types for custom-campaign offers (advertiser -> OEM brokering).
// Pure/isomorphic — safe to import from server components, client islands, and
// route handlers alike. All DB access goes through the SECURITY DEFINER RPCs
// defined in supabase/migrations/20260706_campaign_offers.sql.

export type OfferStatus = 'pending' | 'accepted' | 'rejected';

// One row of the OEM directory (an OEM org, optionally with one of its fleets).
export interface OemDirectoryRow {
  oem_org_id: string;
  oem_name: string;
  fleet_id: string | null;
  fleet_name: string | null;
  region: string | null;
}

// An advertiser's view of an offer they placed.
export interface MyOffer {
  id: string;
  name: string;
  status: OfferStatus;
  decision_reason: string | null;
  oem_name: string;
  fleet_name: string | null;
  budget_total_cents: number;
  created_at: string;
  decided_at: string | null;
}

// The OEM's full view of an incoming offer (everything needed to decide).
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
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
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
