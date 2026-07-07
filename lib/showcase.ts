// Showcase campaigns: demo results Kovio builds for a prospect advertiser.
// Metrics are generated deterministically from the inputs (stable across
// reloads) — directionally plausible fleet numbers meant to be inviting, not
// audited measurements.

export interface ShowcaseMetrics {
  impressions: number;
  attended: number;
  attention_rate: number; // 0..1
  engagements: number;
  avg_dwell_s: number;
  peak_window: string;
  foot_traffic_per_hr: number;
  hours: number;
}

export interface ShowcaseCampaign {
  id?: string;
  name: string;
  video_url: string | null;
  video_kind: 'youtube' | 'file';
  location_label: string | null;
  duration_label: string | null;
  metrics: ShowcaseMetrics;
}

export const DURATION_OPTIONS: Array<{ label: string; hours: number }> = [
  { label: 'Half-day (6h)', hours: 6 },
  { label: 'Full day (12h)', hours: 12 },
  { label: 'Weekend (2 days)', hours: 24 },
  { label: 'Working week (5 days)', hours: 60 },
];

// Small deterministic hash → [0,1). Same inputs, same numbers.
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function generateMetrics(name: string, location: string, durationLabel: string): ShowcaseMetrics {
  const rnd = seeded(`${name}|${location}|${durationLabel}`.toLowerCase());
  const hours = DURATION_OPTIONS.find((d) => d.label === durationLabel)?.hours ?? 6;
  const perHr = Math.round(420 + rnd() * 340); // busy-street foot traffic
  const impressions = Math.round(perHr * hours * (0.92 + rnd() * 0.16));
  const attentionRate = 0.11 + rnd() * 0.05; // 11–16% verified looks
  const attended = Math.round(impressions * attentionRate);
  const engagements = Math.round(attended * (0.16 + rnd() * 0.14));
  const avgDwell = Math.round((1.6 + rnd() * 1.5) * 10) / 10;
  const peaks = ['11a – 1p', '12 – 2p', '5 – 7p', '6 – 8p'];
  return {
    impressions,
    attended,
    attention_rate: attentionRate,
    engagements,
    avg_dwell_s: avgDwell,
    peak_window: peaks[Math.floor(rnd() * peaks.length)],
    foot_traffic_per_hr: perHr,
    hours,
  };
}

// youtube.com/watch?v= | youtu.be/ | shorts/ | already-embed → embed URL.
export function youtubeEmbedUrl(url: string): string | null {
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(url);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`;
}
