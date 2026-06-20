import { z } from 'zod';
import { CATEGORY_KEYS } from '@/lib/categories';

export function normalizeUrl(input: string): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractText(html: string, maxChars = 8000): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, maxChars);
}

export const BrandSchema = z.object({
  company: z.string().describe('The company or brand name.'),
  category: z.enum(CATEGORY_KEYS as [string, ...string[]]).describe('Best-fit category.'),
  campaignName: z.string().describe('A short, catchy campaign name.'),
  summary: z.string().describe('One sentence describing what the company does.'),
});

export type Brand = z.infer<typeof BrandSchema>;
