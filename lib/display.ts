// Shared playlist fetch for the OEM custom-campaign player. Used by the player
// route (initial render) and the /display/<code>/data route (in-page refresh).
// Reads from the cloud public endpoint server-side, so the browser never makes a
// cross-origin call.

const API_BASE = (process.env.NEXT_PUBLIC_KOVIO_API_URL ?? '').replace(/\/$/, '');

export interface PlaylistItem {
  media_url: string;
  media_type: 'image' | 'video';
  duration_seconds: number | null;
}

export interface Playlist {
  ok: boolean; // false => paused / unknown / unreachable; player shows black
  items: PlaylistItem[];
  default_image_seconds: number;
}

export async function fetchPlaylist(code: string): Promise<Playlist> {
  const fallback: Playlist = { ok: false, items: [], default_image_seconds: 8 };
  if (!API_BASE) return fallback;
  try {
    const res = await fetch(`${API_BASE}/display/v1/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    return {
      ok: true,
      items: Array.isArray(data?.items) ? data.items : [],
      default_image_seconds:
        typeof data?.default_image_seconds === 'number' ? data.default_image_seconds : 8,
    };
  } catch {
    return fallback;
  }
}
