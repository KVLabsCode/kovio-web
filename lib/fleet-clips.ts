// Manifest for the dashboard Live Activity hero. Drop MP4s into public/videos/
// and add an entry per clip. An empty FLEET_CLIPS renders the placeholder hero,
// so the feature ships safely before any footage exists.

export type FleetClip = {
  src: string; // e.g. '/videos/market-street.mp4'
  location: string; // shown over the clip, e.g. 'Market Street · San Francisco'
  poster?: string; // optional still shown before the video paints / under reduced motion
};

// Advertiser-facing fleet activation date. Hardcoded for the launch push.
export const FLEET_GO_LIVE = '2026-06-29';

export const FLEET_CLIPS: FleetClip[] = [
  // { src: '/videos/market-street.mp4', location: 'Market Street · San Francisco', poster: '/videos/market-street.jpg' },
];

// Whole calendar days from `now` to `dateISO` (negative once past). Both sides are
// floored to local midnight so the result is stable across the day; Math.round
// absorbs the <=1h DST drift between two midnights.
export function daysUntil(dateISO: string, now: Date): number {
  const target = new Date(`${dateISO}T00:00:00`);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function goLiveLabel(days: number): string {
  if (days > 1) return `Live in ${days} days`;
  if (days === 1) return 'Live in 1 day';
  if (days === 0) return 'Going live today';
  return 'Live now';
}

export function goLiveDateLabel(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
}

export function nextIndex(current: number, length: number): number {
  return length > 0 ? (current + 1) % length : 0;
}
