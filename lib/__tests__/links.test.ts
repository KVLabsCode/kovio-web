import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

import { genCode } from '@/lib/links';

describe('genCode', () => {
  it('produces an id of the requested length', () => {
    expect(genCode(8)).toHaveLength(8);
    expect(genCode(12)).toHaveLength(12);
  });
  it('uses only url-safe chars', () => {
    expect(genCode(40)).toMatch(/^[0-9A-Za-z]+$/);
  });
  it('is practically unique across calls', () => {
    const seen = new Set(Array.from({ length: 500 }, () => genCode(8)));
    expect(seen.size).toBe(500);
  });
});
