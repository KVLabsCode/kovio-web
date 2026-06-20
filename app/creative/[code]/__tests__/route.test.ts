import { describe, it, expect, vi, beforeEach } from 'vitest';

const maybeSingle = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock('@/lib/qr', () => ({ qrSvg: async (u: string) => `<svg data-url="${u}"></svg>` }));

import { GET } from '@/app/creative/[code]/route';

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const request = new Request('http://localhost/creative/abc');

beforeEach(() => maybeSingle.mockReset());

describe('GET /creative/[code]', () => {
  it('renders html with the image and a QR svg pointing at /r/code', async () => {
    maybeSingle.mockResolvedValue({ data: { image_url: 'https://img.example/a.png' }, error: null });
    const res = await GET(request, ctx('abc'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('https://img.example/a.png');
    expect(html).toContain('<svg');
    expect(html).toContain('http://localhost/r/abc');
  });

  it('404s with fallback html for an unknown code', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await GET(request, ctx('nope'));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('escapes a malicious image_url so it cannot break out of the src attribute', async () => {
    maybeSingle.mockResolvedValue({
      data: { image_url: 'https://x/"><script>alert(1)</script>' },
      error: null,
    });
    const res = await GET(request, ctx('abc'));
    const html = await res.text();
    expect(html).not.toContain('"><script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });
});
