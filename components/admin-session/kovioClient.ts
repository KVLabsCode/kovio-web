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
  status: 'recording' | 'stopped';
  started_at: string;
  ended_at: string | null;
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

  start: (robotId: string, displayId: string) =>
    req<SessionInfo>('/session/v1/start', {
      method: 'POST',
      body: JSON.stringify({ robot_id: robotId, display_id: displayId }),
    }),

  stop: (sessionId: string) =>
    req<SessionInfo>('/session/v1/stop', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),

  current: (robotExternalId: string) =>
    req<{ active: boolean; session_id: string | null; started_at: string | null }>(
      `/session/v1/current?robot_id=${encodeURIComponent(robotExternalId)}`
    ),

  summary: (sessionId: string) =>
    req<SessionSummary>(`/session/v1/summary?session_id=${encodeURIComponent(sessionId)}`),

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
