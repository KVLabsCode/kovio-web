export const CATEGORIES: Array<[string, string]> = [
  ['food', 'food'],
  ['beverage', 'beverage'],
  ['retail', 'retail'],
  ['fashion', 'fashion'],
  ['beauty', 'beauty'],
  ['tech', 'tech'],
  ['gaming', 'gaming'],
  ['automotive', 'automotive'],
  ['finance', 'finance'],
  ['health', 'health & fitness'],
  ['travel', 'travel'],
  ['realestate', 'real estate'],
  ['entertainment', 'entertainment'],
  ['events', 'events'],
  ['hospitality', 'hospitality'],
  ['nonprofit', 'nonprofit'],
  ['other', 'other'],
];

export const CATEGORY_KEYS: string[] = CATEGORIES.map(([value]) => value);

export function categoryLabel(value: string): string {
  return CATEGORIES.find(([v]) => v === value)?.[1] ?? value;
}
