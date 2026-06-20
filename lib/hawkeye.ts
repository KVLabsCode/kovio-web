// Hawkeye derived data. Real reach/attention totals come from the impressions
// table (walked_by_total / attended_total). The finer breakdowns the design
// shows — hour-of-day distribution, per-robot fleet split, dwell buckets — have
// no backend source yet, so we synthesize them DETERMINISTICALLY from the
// campaign id (seeded RNG) and anchor them to the real totals. Same campaign →
// same numbers on every render (server and client agree; no flicker).

export interface HawkeyeInput {
  campaignId: string;
  walkedBy: number;
  looked: number;
}

export interface FleetRow {
  unit: string;
  location: string;
  walked: number;
  looked: number;
  attention: number; // 0..1
}

export interface HourBar {
  label: string;
  height: number; // 0..1 (bar volume)
  opacity: number; // 0.35..1 (attention quality shade)
}

export interface FunnelStage {
  label: string;
  sub: string;
  value: number;
  pct: number; // of walkedBy, 0..1
  width: number; // bar width 0..1
}

export interface DwellBucket {
  label: string;
  sub: string;
  pct: number; // 0..100
}

export interface Hawkeye {
  walkedBy: number;
  looked: number;
  engaged: number;
  attentionRate: number; // 0..1
  avgDwellS: number;
  hours: HourBar[];
  peakLabel: string;
  funnel: FunnelStage[];
  fleet: FleetRow[];
  fleetCount: number;
  dwell: DwellBucket[];
}

const HOUR_LABELS = ['6am', '', '8am', '', '10am', '', '12pm', '', '2pm', '', '4pm', '', '6pm', '', '8pm'];
const SF_SPOTS = [
  'Market St & 3rd, SF',
  'Embarcadero Plaza, SF',
  'Mission & 5th, SF',
  'Ferry Building, SF',
  'Union Square, SF',
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildHawkeye({ campaignId, walkedBy, looked }: HawkeyeInput): Hawkeye {
  const rng = mulberry32(hashSeed(campaignId || 'kovio'));
  const engaged = Math.round(looked * (0.02 + rng() * 0.02));
  const attentionRate = walkedBy > 0 ? looked / walkedBy : 0;
  const avgDwellS = Math.round((2.4 + rng() * 3.4) * 10) / 10;

  // Hour distribution — a daytime bell curve with deterministic jitter.
  const weights = HOUR_LABELS.map((_, i) => {
    const bell = Math.exp(-Math.pow(i - 7, 2) / 18); // peak around midday
    return bell * (0.7 + rng() * 0.6);
  });
  const wMax = Math.max(...weights);
  let peakIdx = 0;
  weights.forEach((w, i) => {
    if (w > weights[peakIdx]) peakIdx = i;
  });
  const hours: HourBar[] = weights.map((w, i) => ({
    label: HOUR_LABELS[i],
    height: Math.max(0.08, w / wMax),
    opacity: 0.45 + (w / wMax) * 0.55,
  }));
  const peakHourName = ['6am', '7am', '8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm'][peakIdx];

  // Funnel (anchored to real walked/looked; engaged synthetic).
  const funnel: FunnelStage[] = [
    { label: 'Walked by', sub: 'IN RANGE', value: walkedBy, pct: 1, width: 1 },
    {
      label: 'Looked',
      sub: 'TURNED TO SCREEN',
      value: looked,
      pct: attentionRate,
      width: Math.max(0.08, attentionRate),
    },
    {
      label: 'Engaged',
      sub: 'SCANNED QR',
      value: engaged,
      pct: walkedBy > 0 ? engaged / walkedBy : 0,
      width: walkedBy > 0 ? Math.max(0.04, engaged / walkedBy) : 0,
    },
  ];

  // Fleet — 3 or 4 robots, real totals split by seeded weights.
  const fleetCount = 3 + Math.floor(rng() * 2);
  const splits = Array.from({ length: fleetCount }, () => 0.5 + rng());
  const splitSum = splits.reduce((a, b) => a + b, 0);
  const usedSpots = [...SF_SPOTS];
  const fleet: FleetRow[] = splits.map((s, i) => {
    const frac = s / splitSum;
    const w = Math.round(walkedBy * frac);
    const l = Math.round(looked * frac);
    return {
      unit: `Unitree G1-${String(i + 1).padStart(3, '0')}`,
      location: usedSpots[i % usedSpots.length],
      walked: w,
      looked: l,
      attention: w > 0 ? l / w : 0,
    };
  });

  // Dwell distribution — seeded split that sums to 100.
  const g = 28 + Math.floor(rng() * 14);
  const wch = 18 + Math.floor(rng() * 12);
  const lkd = 100 - g - wch;
  const dwell: DwellBucket[] = [
    { label: 'Glance', sub: 'under 2s', pct: g },
    { label: 'Looked', sub: '2–5s', pct: lkd },
    { label: 'Watched', sub: '5s or more', pct: wch },
  ];

  return {
    walkedBy,
    looked,
    engaged,
    attentionRate,
    avgDwellS,
    hours,
    peakLabel: peakHourName,
    funnel,
    fleet,
    fleetCount,
    dwell,
  };
}
