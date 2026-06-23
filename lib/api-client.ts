// Browser-side API client. Used by client components for mutations. Reads the
// Supabase session token from the browser client and forwards it as a Bearer
// token to kovio-api. Never throws — returns { data, error }.

'use client';

import { createClient } from '@/lib/supabase/client';
import type {
  Campaign,
  Fleet,
  MeResponse,
  MintedApiKey,
  OemMeResponse,
  Result,
} from '@/lib/types';

const API = process.env.NEXT_PUBLIC_KOVIO_API_URL!;

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(await authHeader()),
      ...((init?.headers as Record<string, string>) ?? {}),
    };
    const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return {
        data: null,
        error: { status: res.status, code: body?.code, detail: body?.detail },
      };
    }
    return { data: body as T, error: null };
  } catch {
    return { data: null, error: { status: 0, detail: 'network error' } };
  }
}

export interface OnboardBody {
  org_name: string;
  org_slug: string;
}

export interface CreateCampaignBody {
  campaign_id: string;
  name: string;
  advertiser: string;
  creative_url: string;
  targeting: Array<Record<string, unknown>>;
  priority: number;
  encounter_cap_seconds: number;
  category?: string | null;
  budget_total_cents: number;
  cost_per_impression_cents: number;
  cost_per_attended_cents: number;
  start_at: string;
  end_at?: string | null;
}

export const apiClient = {
  onboard: (body: OnboardBody) =>
    call<MeResponse>('/advertiser/v1/onboarding', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createCampaign: (body: CreateCampaignBody) =>
    call<Campaign>('/advertiser/v1/campaigns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  pauseCampaign: (id: string) =>
    call<Campaign>(`/advertiser/v1/campaigns/${id}/pause`, { method: 'POST' }),
  resumeCampaign: (id: string) =>
    call<Campaign>(`/advertiser/v1/campaigns/${id}/resume`, { method: 'POST' }),
  deposit: (amount_cents: number) =>
    call<{ balance_cents: number }>('/advertiser/v1/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount_cents }),
    }),
  // Stripe Checkout: returns a hosted URL to redirect the buyer to. The balance
  // is credited by the webhook after Stripe confirms payment, not here.
  checkout: (amount_cents: number) =>
    call<{ url: string }>('/advertiser/v1/checkout', {
      method: 'POST',
      body: JSON.stringify({ amount_cents }),
    }),
  // OEM
  oemMe: () => call<OemMeResponse>('/oem/v1/me'),
  oemOnboard: (body: { org_name: string; org_slug: string }) =>
    call<OemMeResponse>('/oem/v1/onboarding', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  oemCreateFleet: (body: { name: string; region?: string }) =>
    call<Fleet>('/oem/v1/fleets', { method: 'POST', body: JSON.stringify(body) }),
  oemUpdateFleet: (id: string, body: Record<string, unknown>) =>
    call<Fleet>(`/oem/v1/fleets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  oemMintApiKey: (fleetId: string, body: { name: string }) =>
    call<MintedApiKey>(`/oem/v1/fleets/${fleetId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  oemRevokeApiKey: (fleetId: string, keyId: string) =>
    call<null>(`/oem/v1/fleets/${fleetId}/api-keys/${keyId}`, { method: 'DELETE' }),
};
