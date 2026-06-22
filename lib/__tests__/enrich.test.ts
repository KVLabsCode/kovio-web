import { describe, it, expect } from 'vitest';
import { normalizeUrl, extractText, BrandSchema } from '@/lib/enrich';

describe('normalizeUrl', () => {
  it('adds https when scheme missing', () => {
    expect(normalizeUrl('acme.com')).toBe('https://acme.com/');
  });
  it('keeps an existing scheme', () => {
    expect(normalizeUrl('http://acme.com/x')).toBe('http://acme.com/x');
  });
  it('trims whitespace', () => {
    expect(normalizeUrl('  acme.com ')).toBe('https://acme.com/');
  });
  it('returns null for junk', () => {
    expect(normalizeUrl('not a url at all')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });
});

describe('extractText', () => {
  it('strips tags, scripts and styles', () => {
    const html =
      '<html><head><style>.a{color:red}</style><script>x=1</script></head>' +
      '<body><h1>Acme</h1><p>We sell  widgets.</p></body></html>';
    const text = extractText(html);
    expect(text).toContain('Acme');
    expect(text).toContain('We sell widgets.');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('x=1');
  });
  it('truncates to maxChars', () => {
    expect(extractText('<p>' + 'a'.repeat(100) + '</p>', 10).length).toBe(10);
  });
});

describe('BrandSchema', () => {
  it('accepts a valid object', () => {
    const ok = BrandSchema.safeParse({
      company: 'Acme', category: 'retail', campaignName: 'Acme Launch', summary: 'Sells widgets.',
    });
    expect(ok.success).toBe(true);
  });
  it('rejects an out-of-enum category', () => {
    const bad = BrandSchema.safeParse({
      company: 'Acme', category: 'spaceships', campaignName: 'x', summary: 'y',
    });
    expect(bad.success).toBe(false);
  });
});
