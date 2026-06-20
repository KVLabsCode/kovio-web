import { describe, it, expect } from 'vitest';
import { CATEGORIES, CATEGORY_KEYS, categoryLabel } from '@/lib/categories';

describe('categories', () => {
  it('exposes value/label pairs', () => {
    expect(CATEGORIES).toContainEqual(['food', 'food']);
    expect(CATEGORIES).toContainEqual(['health', 'health & fitness']);
  });
  it('derives keys from pairs', () => {
    expect(CATEGORY_KEYS).toEqual(CATEGORIES.map(([v]) => v));
    expect(CATEGORY_KEYS).toContain('retail');
  });
  it('maps a value to its label', () => {
    expect(categoryLabel('realestate')).toBe('real estate');
    expect(categoryLabel('unknown')).toBe('unknown');
  });
});
