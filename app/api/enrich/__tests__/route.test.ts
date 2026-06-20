import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const generateObject = vi.fn();
vi.mock('ai', () => ({ generateObject: (...a: unknown[]) => generateObject(...a) }));

import { POST } from '@/app/api/enrich/route';

function req(body: unknown) {
  return new Request('http://localhost/api/enrich', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getUser.mockReset();
  generateObject.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response('<html><body><h1>Acme</h1>widgets</body></html>', { status: 200 })));
});

describe('POST /api/enrich', () => {
  it('401 when unauthenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ url: 'acme.com' }));
    expect(res.status).toBe(401);
  });

  it('400 on invalid url', async () => {
    const res = await POST(req({ url: 'nonsense' }));
    expect(res.status).toBe(400);
  });

  it('200 with brand fields on success', async () => {
    generateObject.mockResolvedValue({
      object: { company: 'Acme', category: 'retail', campaignName: 'Acme Launch', summary: 'Sells widgets.' },
    });
    const res = await POST(req({ url: 'acme.com' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      company: 'Acme', category: 'retail', campaignName: 'Acme Launch', summary: 'Sells widgets.',
    });
  });

  it('502 when the model call throws', async () => {
    generateObject.mockRejectedValue(new Error('model down'));
    const res = await POST(req({ url: 'acme.com' }));
    expect(res.status).toBe(502);
  });
});
