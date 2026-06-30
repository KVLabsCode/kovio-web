// Single source of truth for money / count / time formatting. Page files must
// use these rather than inlining cents math or Date formatting.

export const formatMoney = (cents: number): string => {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
};

export const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

export const formatPct = (decimal: number): string => `${(decimal * 100).toFixed(1)}%`;

// Dwell seconds. 0 is the "no data" sentinel from the audience summary -> "—".
export const formatDwell = (seconds: number | null | undefined): string =>
  seconds != null && seconds > 0 ? `${seconds.toFixed(1)}s` : '—';

// Proximity / approach distance in metres; null/undefined -> "—".
export const formatDistance = (m: number | null | undefined): string =>
  m != null ? `${m.toFixed(1)}m` : '—';

// Human label for an interaction kind key (handshake -> "Handshakes", etc.).
export const interactionLabel = (kind: string): string => {
  const map: Record<string, string> = {
    handshake: 'Handshakes',
    wave: 'Waves',
    high_five: 'High-fives',
    fist_bump: 'Fist bumps',
    phone_out: 'Phones out',
    gaze_dwell: 'Sustained looks',
  };
  return map[kind] ?? kind.replace(/_/g, ' ');
};

// Attention rate = people who faced the screen / people who passed by. Derived
// from the totals (not the API's `attention_rate`, which divided by impressions
// and could exceed 100%) so the list, dashboard, and detail page never drift.
// Returns null when there's no reach data yet, so callers can render "—".
export function attentionRate(s: {
  walked_by_total?: number | null;
  attended_total?: number | null;
  impressions_total?: number | null;
}): number | null {
  const walked = s.walked_by_total ?? 0;
  const attended = s.attended_total ?? 0;
  if (walked > 0) return attended / walked;
  const impressions = s.impressions_total ?? 0;
  return impressions > 0 ? attended / impressions : null;
}

export const formatRelative = (iso: string): string => {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 5) return 'now';
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
