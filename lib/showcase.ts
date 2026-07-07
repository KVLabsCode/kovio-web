// Showcase campaigns: demo results Kovio builds for a prospect advertiser.
// Metrics are generated deterministically from the inputs (stable across
// reloads) — directionally plausible fleet numbers meant to be inviting, not
// audited measurements.

export interface ShowcaseMetrics {
  impressions: number; // people who passed within view
  attended: number; // verified looks
  attention_rate: number; // 0..1
  engagements: number;
  avg_dwell_s: number;
  peak_window: string;
  foot_traffic_per_hr: number;
  hours: number;
  // Engagement signals
  views: number;
  captures: number; // phones raised to film the robot
  qr_scans: number;
  touches: number;
  approaches: number; // stepped toward the robot
  // Dwell split (percentages, sum ≈ 100)
  dwell_glance_pct: number;
  dwell_looked_pct: number;
  dwell_watched_pct: number;
  // "When they looked" — per-slot counts + labels (e.g. 11am … 4pm)
  hourly: number[];
  hourly_labels: string[];
}

export interface ShowcaseCampaign {
  id?: string;
  name: string;
  video_url: string | null;
  video_kind: 'youtube' | 'file';
  location_label: string | null;
  duration_label: string | null;
  metrics: Partial<ShowcaseMetrics>;
}

export const DURATION_OPTIONS: Array<{ label: string; hours: number }> = [
  { label: '2 hours', hours: 2 },
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

function hourLabel(h24: number): string {
  const h = ((h24 - 1) % 12) + 1;
  return `${h}${h24 < 12 || h24 === 24 ? 'am' : 'pm'}`;
}

export function generateMetrics(name: string, location: string, durationLabel: string): ShowcaseMetrics {
  const rnd = seeded(`${name}|${location}|${durationLabel}`.toLowerCase());
  const hours = DURATION_OPTIONS.find((d) => d.label === durationLabel)?.hours ?? 6;
  const perHr = Math.round(380 + rnd() * 360); // busy-street foot traffic
  const impressions = Math.round(perHr * hours * (0.92 + rnd() * 0.16));
  // Robots are novel — attention rates run far above static signage.
  const attentionRate = 0.34 + rnd() * 0.14; // 34–48% verified looks
  const attended = Math.round(impressions * attentionRate);
  const captures = Math.round(attended * (0.12 + rnd() * 0.08));
  const qrScans = Math.round(attended * (0.02 + rnd() * 0.03));
  const touches = Math.round(attended * (0.006 + rnd() * 0.01));
  const approaches = Math.round(attended * (0.08 + rnd() * 0.06));
  const engagements = qrScans + touches + Math.round(captures * 0.2);
  const avgDwell = Math.round((2.4 + rnd() * 2.2) * 10) / 10;

  // Dwell split
  const glance = Math.round(34 + rnd() * 12);
  const watched = Math.round(10 + rnd() * 9);
  const looked = 100 - glance - watched;

  // Hourly curve: bell-ish shape across up to 7 slots.
  const slots = Math.min(7, Math.max(4, Math.round(hours / (hours > 12 ? 8 : 1))));
  const startHour = 11 + Math.floor(rnd() * 2); // 11am or 12pm start
  const mid = (slots - 1) / 2;
  const hourly: number[] = [];
  const labels: string[] = [];
  for (let i = 0; i < slots; i++) {
    const bell = 1 - Math.abs(i - mid) / (mid + 1);
    hourly.push(Math.round(perHr * (0.45 + bell * 0.75 + rnd() * 0.18)));
    labels.push(hourLabel(startHour + i));
  }
  const peakIdx = hourly.indexOf(Math.max(...hourly));
  const peakWindow = `${labels[peakIdx]} – ${hourLabel(startHour + peakIdx + 2)}`;

  return {
    impressions,
    attended,
    attention_rate: attentionRate,
    engagements,
    avg_dwell_s: avgDwell,
    peak_window: peakWindow,
    foot_traffic_per_hr: perHr,
    hours,
    views: attended,
    captures,
    qr_scans: qrScans,
    touches,
    approaches,
    dwell_glance_pct: glance,
    dwell_looked_pct: looked,
    dwell_watched_pct: watched,
    hourly,
    hourly_labels: labels,
  };
}

// Older showcase rows may have been stored with fewer metric fields — fill any
// gaps deterministically so the report always renders complete.
export function fullMetrics(c: ShowcaseCampaign): ShowcaseMetrics {
  const gen = generateMetrics(c.name, c.location_label ?? '', c.duration_label ?? '');
  return { ...gen, ...(c.metrics as ShowcaseMetrics) } as ShowcaseMetrics;
}

// youtube.com/watch?v= | youtu.be/ | shorts/ | already-embed → embed URL.
export function youtubeEmbedUrl(url: string): string | null {
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(url);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : `${n}`;
}
