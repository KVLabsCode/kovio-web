import { describe, it, expect, vi, beforeEach } from 'vitest';

// kovioClient reads NEXT_PUBLIC_KOVIO_API_URL at import and the fleet key from
// window.sessionStorage, so we stub both, then dynamic-import a fresh module.
type KovioClient = typeof import('@/components/admin-session/kovioClient');

const store = new Map<string, string>();

async function loadClient(): Promise<KovioClient> {
  process.env.NEXT_PUBLIC_KOVIO_API_URL = 'https://api.test';
  (globalThis as unknown as { window: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  vi.resetModules();
  const mod = await import('@/components/admin-session/kovioClient');
  mod.setFleetKey('kov_test_key');
  return mod;
}

describe('sessionApi.speak', () => {
  beforeEach(() => {
    store.clear();
  });

  it('POSTs robot_id + text + volume with bearer + JSON headers', async () => {
    const { sessionApi } = await loadClient();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(
      async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return { ok: true, json: async () => ({ ok: true, nonce: 'n1' }) };
      },
    );

    const out = await sessionApi.speak('robot-uuid', 'hello world', 100);

    expect(out).toEqual({ ok: true, nonce: 'n1' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/session/v1/speak');
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer kov_test_key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      robot_id: 'robot-uuid',
      text: 'hello world',
      volume: 100,
    });
  });

  it('sends volume null when omitted', async () => {
    const { sessionApi } = await loadClient();
    let body: unknown;
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(
      async (_url: string, init: RequestInit) => {
        body = JSON.parse(init.body as string);
        return { ok: true, json: async () => ({ ok: true, nonce: 'n' }) };
      },
    );

    await sessionApi.speak('r', 'hi');
    expect(body).toEqual({ robot_id: 'r', text: 'hi', volume: null });
  });

  it('surfaces the server error detail (e.g. no open session)', async () => {
    const { sessionApi } = await loadClient();
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'No open session for this robot.' }),
    }));

    await expect(sessionApi.speak('r', 'hi')).rejects.toThrow(
      'No open session for this robot.',
    );
  });
});
