// Server-side API client. Used by server components / route handlers. Reads the
// Supabase session token via the cookie-based server client and forwards it as a
// Bearer token to the kovio-api FastAPI service. Never throws — returns
// { data, error }.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  Campaign,
  CampaignDetail,
  Dashboard,
  Fleet,
  FleetDetail,
  MeResponse,
  OemDashboard,
  OemMeResponse,
  Result,
} from '@/lib/types';

const API = process.env.NEXT_PUBLIC_KOVIO_API_URL!;

async function authHeader(): Promise<Record<string, string>> {
  const supabase = await createClient();
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

// Each read is wrapped in React.cache() so repeated calls within a single server
// render (e.g. the Sidebar and the page both reading /me + /dashboard) collapse to
// ONE network round-trip. `no-store` keeps the data fresh across requests; cache()
// only dedupes within a request — the two are complementary.
export const api = {
  me: cache(() => call<MeResponse>('/advertiser/v1/me')),
  dashboard: cache(() => call<Dashboard>('/advertiser/v1/dashboard')),
  campaigns: cache(() => call<{ campaigns: Campaign[] }>('/advertiser/v1/campaigns')),
  campaign: cache((id: string) => call<CampaignDetail>(`/advertiser/v1/campaigns/${id}`)),
  // OEM (server reads)
  oemMe: cache(() => call<OemMeResponse>('/oem/v1/me')),
  oemDashboard: cache((range?: string) =>
    call<OemDashboard>(`/oem/v1/dashboard${range ? `?range=${range}` : ''}`)),
  oemFleets: cache(() => call<{ fleets: Fleet[] }>('/oem/v1/fleets')),
  oemFleet: cache((id: string) => call<FleetDetail>(`/oem/v1/fleets/${id}`)),
};
