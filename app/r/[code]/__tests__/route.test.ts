import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc }),
}));

import { GET } from '@/app/r/[code]/route';

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const request = new Request('http://localhost/r/abc');

beforeEach(() => rpc.mockReset());

describe('GET /r/[code]', () => {
  it('302s to the target url', async () => {
    rpc.mockResolvedValue({ data: 'https://acme.com/', error: null });
    const res = await GET(request, ctx('abc'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://acme.com/');
    expect(rpc).toHaveBeenCalledWith('increment_scan', { p_code: 'abc' });
  });

  it('redirects home when code is unknown', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const res = await GET(request, ctx('nope'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost/');
  });
});
