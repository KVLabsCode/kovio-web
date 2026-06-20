import type { CreateCampaignBody } from '@/lib/api-client';

export interface DraftCore {
  name: string;
  company: string;
  category: string;
  budget: string;
  start: string; // yyyy-mm-dd
  duration: number;
  code: string;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campaign';
}
function rand(n: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function creativeUrlFor(origin: string, code: string): string {
  return `${origin}/creative/${code}`;
}

export function buildCampaignBody(args: {
  draft: DraftCore;
  mode: 'trial' | 'paid';
  origin: string;
}): CreateCampaignBody {
  const { draft, mode, origin } = args;
  const days = mode === 'trial' ? 7 : draft.duration;
  const startMs = new Date(draft.start + 'T00:00:00').getTime();
  const endIso = new Date(startMs + days * 86400000).toISOString();
  return {
    campaign_id: `${slugify(draft.name)}-${rand(4).toLowerCase()}`,
    name: draft.name.trim() || 'Untitled campaign',
    advertiser: draft.company.trim() || 'Brand',
    creative_url: creativeUrlFor(origin, draft.code),
    targeting: [{ field: 'person_count', op: '>=', value: 1 }],
    priority: 10,
    encounter_cap_seconds: 300,
    category: draft.category,
    budget_total_cents: mode === 'trial' ? 50000 : Number(draft.budget) * 100,
    cost_per_impression_cents: 10,
    cost_per_attended_cents: 5,
    start_at: new Date(draft.start + 'T00:00:00').toISOString(),
    end_at: endIso,
  };
}
