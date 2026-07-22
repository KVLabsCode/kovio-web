// Admin-session client for the kovio-api /session/v1 endpoints.
//
// This is the ONE module that holds the fleet key. The admin pastes an
// existing SDK fleet key (e.g. the "G1" key) into the session panel; it lives
// in sessionStorage only — never in the repo, never in a cookie — and every
// call to kovio-api goes through here, so a later swap to server-side key
// custody is a one-file change. Additive admin namespace: nothing here is
// imported by any customer surface.

const API = process.env.NEXT_PUBLIC_KOVIO_API_URL!;
const KEY_STORAGE = 'kovio.admin.session.fleet_key';

export interface SessionRobot {
  id: string;
  external_id: string;
  status: string;
  last_heartbeat: string | null;
  online: boolean;
}

export interface SessionInfo {
  id: string;
  robot_id: string;
  display_id: string | null;
  campaign_id: string | null;
  is_blended: boolean;
  status: 'recording' | 'stopped';
  started_at: string;
  ended_at: string | null;
}

// --- V2: audience metrics, playlist, demo library, reports -----------------

export interface SessionCampaign {
  id: string;
  name: string;
  advertiser: string;
  status: string;
  enabled: boolean;
}

export interface SensorHealth {
  lidar_ok: boolean;
  lidar_hz: number;
  depth_ok: boolean;
  age_seconds: number | null;
}

export interface SessionMetrics {
  session_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  is_blended: boolean;
  campaign_id: string | null;
  reach_unique: number;
  passersby_gross: number;
  dwell_paused_plus: number;
  dwell_engaged_plus: number;
  dwell_deep: number;
  close_approaches: number;
  sensor: SensorHealth | null;
  degraded: boolean;
}

export interface DisplayItem {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration_seconds: number | null;
  position: number;
}

export interface DisplayItems {
  display_id: string;
  name: string;
  default_image_seconds: number;
  items: DisplayItem[];
}

export interface DemoCreative {
  id: string;
  org_id: string | null;
  label: string;
  media_url: string;
  media_type: 'image' | 'video';
  default_seconds: number;
  is_demo: boolean;
}

export interface AudienceSessionRow {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  is_blended: boolean;
  campaign_id: string | null;
  display_id: string | null;
  reach_unique: number;
  passersby_gross: number;
  dwell_engaged_plus: number;
  dwell_deep: number;
  close_approaches: number;
}

export interface AudienceRollup {
  scope: 'campaign' | 'display';
  scope_id: string;
  label: string;
  blended: boolean;
  creative_count: number | null;
  from_ts: string | null;
  to_ts: string | null;
  reach_unique: number;
  passersby_gross: number;
  dwell_paused_plus: number;
  dwell_engaged_plus: number;
  dwell_deep: number;
  close_approaches: number;
  sessions: AudienceSessionRow[];
}

export interface SessionSummary {
  session_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  impressions: number;
  person_count: number;
  attended_count: number;
  latest_campaign: string | null;
  last_frame_age_seconds: number | null;
}

export function getFleetKey(): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(KEY_STORAGE) ?? '';
}

export function setFleetKey(key: string) {
  if (typeof window === 'undefined') return;
  if (key) window.sessionStorage.setItem(KEY_STORAGE, key);
  else window.sessionStorage.removeItem(KEY_STORAGE);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getFleetKey();
  if (!key) throw new Error('Set the fleet key first.');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const sessionApi = {
  robots: () =>
    req<{ robots: SessionRobot[]; online_threshold_seconds: number }>('/session/v1/robots'),

  start: (robotId: string, displayId: string, campaignId?: string | null) =>
    req<SessionInfo>('/session/v1/start', {
      method: 'POST',
      body: JSON.stringify({
        robot_id: robotId,
        display_id: displayId,
        campaign_id: campaignId || null,
      }),
    }),

  stop: (sessionId: string) =>
    req<SessionInfo>('/session/v1/stop', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),

  // Queue a line of TTS for a robot's open session. The robot speaks it on its
  // next /current poll (~5s worst case). Requires an open session server-side.
  speak: (robotId: string, text: string, volume?: number | null) =>
    req<{ ok: boolean; nonce: string }>('/session/v1/speak', {
      method: 'POST',
      body: JSON.stringify({
        robot_id: robotId,
        text,
        volume: volume ?? null,
      }),
    }),

  // Open a push-to-talk window: the robot captures mic audio once, transcribes
  // it on-device, and replies out its speaker. Same open-session gate as speak.
  listen: (robotId: string) =>
    req<{ ok: boolean; nonce: string }>('/session/v1/listen', {
      method: 'POST',
      body: JSON.stringify({ robot_id: robotId }),
    }),

  current: (robotExternalId: string) =>
    req<{ active: boolean; session_id: string | null; started_at: string | null }>(
      `/session/v1/current?robot_id=${encodeURIComponent(robotExternalId)}`
    ),

  summary: (sessionId: string) =>
    req<SessionSummary>(`/session/v1/summary?session_id=${encodeURIComponent(sessionId)}`),

  // V2 live tiles: unique reach / dwell tiers / close approaches + sensor health.
  metrics: (sessionId: string) =>
    req<SessionMetrics>(`/session/v1/metrics?session_id=${encodeURIComponent(sessionId)}`),

  // Start-time campaign picker — server already limits to the key org.
  campaigns: () => req<SessionCampaign[]>('/session/v1/campaigns'),

  demoCreatives: () => req<DemoCreative[]>('/session/v1/demo-creatives'),

  items: (displayId: string) =>
    req<DisplayItems>(`/display/v1/${encodeURIComponent(displayId)}/items`),

  addItem: (displayId: string, item: { media_url: string; media_type: string; duration_seconds?: number | null }) =>
    req<DisplayItems>(`/display/v1/${encodeURIComponent(displayId)}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  patchItem: (displayId: string, itemId: string, durationSeconds: number | null) =>
    req<DisplayItems>(
      `/display/v1/${encodeURIComponent(displayId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'PATCH', body: JSON.stringify({ duration_seconds: durationSeconds }) }
    ),

  deleteItem: (displayId: string, itemId: string) =>
    req<DisplayItems>(
      `/display/v1/${encodeURIComponent(displayId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' }
    ),

  reorderItems: (displayId: string, itemIds: string[]) =>
    req<DisplayItems>(`/display/v1/${encodeURIComponent(displayId)}/items/reorder`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    }),

  loadPreset: (displayId: string, creativeIds: string[]) =>
    req<DisplayItems>(`/display/v1/${encodeURIComponent(displayId)}/load-preset`, {
      method: 'POST',
      body: JSON.stringify({ creative_ids: creativeIds }),
    }),

  displayAudience: (displayId: string) =>
    req<AudienceRollup>(`/display/v1/${encodeURIComponent(displayId)}/audience`),

  campaignAudience: (campaignId: string) =>
    req<AudienceRollup>(`/campaign/v1/${encodeURIComponent(campaignId)}/audience`),

  // The frame endpoint needs the Bearer header, which an <img src> can't send —
  // fetch the JPEG as a blob and hand back an object URL (caller revokes it).
  fetchFrame: async (robotId: string): Promise<string | null> => {
    const key = getFleetKey();
    if (!key) return null;
    const res = await fetch(
      `${API}/session/v1/frame?robot_id=${encodeURIComponent(robotId)}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};
