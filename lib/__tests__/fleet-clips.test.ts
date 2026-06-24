import { describe, it, expect } from 'vitest';
import {
  FLEET_CLIPS,
  FLEET_GO_LIVE,
  daysUntil,
  goLiveLabel,
  goLiveDateLabel,
  nextIndex,
} from '@/lib/fleet-clips';

describe('fleet-clips manifest', () => {
  it('ships empty so prod renders the placeholder until assets are added', () => {
    expect(FLEET_CLIPS).toEqual([]);
  });
  it('targets the launch date', () => {
    expect(FLEET_GO_LIVE).toBe('2026-06-29');
  });
});

describe('daysUntil', () => {
  it('counts whole days to a future date regardless of time of day', () => {
    expect(daysUntil('2026-06-29', new Date('2026-06-24T20:00:00'))).toBe(5);
    expect(daysUntil('2026-06-29', new Date('2026-06-24T01:00:00'))).toBe(5);
  });
  it('is 0 on the day itself', () => {
    expect(daysUntil('2026-06-29', new Date('2026-06-29T09:00:00'))).toBe(0);
  });
  it('is negative once the date has passed', () => {
    expect(daysUntil('2026-06-29', new Date('2026-07-01T09:00:00'))).toBe(-2);
  });
});

describe('goLiveLabel', () => {
  it('pluralizes the countdown', () => {
    expect(goLiveLabel(5)).toBe('Live in 5 days');
    expect(goLiveLabel(1)).toBe('Live in 1 day');
  });
  it('handles launch day and after', () => {
    expect(goLiveLabel(0)).toBe('Going live today');
    expect(goLiveLabel(-3)).toBe('Live now');
  });
});

describe('goLiveDateLabel', () => {
  it('formats as month and day', () => {
    expect(goLiveDateLabel('2026-06-29')).toBe('June 29');
  });
});

describe('nextIndex', () => {
  it('wraps around the set', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
  it('returns 0 for an empty set', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});
