import { describe, it, expect } from 'vitest';
import { brandStepReady } from '@/lib/campaign-draft';

describe('brandStepReady', () => {
  it('false without a website', () => {
    expect(brandStepReady({ website: '', company: '' })).toBe(false);
  });
  it('false with an invalid website', () => {
    expect(brandStepReady({ website: 'nonsense', company: 'Acme' })).toBe(false);
  });
  it('true with a valid website', () => {
    expect(brandStepReady({ website: 'acme.com', company: 'Acme' })).toBe(true);
  });
});
