# Brand-aware Campaign Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a website-driven onramp to the campaign wizard that uses AI to auto-fill setup fields and bakes a tracked QR code onto a Kovio-hosted creative.

**Architecture:** New Next.js route handlers in this repo do the server work (website fetch + LLM summarize, QR redirect, hosted creative HTML), backed by a `campaign_links` Supabase table. Pure helpers (`lib/enrich`, `lib/qr`, `lib/links`, `lib/campaign-draft`) hold the logic; routes orchestrate. The wizard gains a "Brand" step 1.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19, TypeScript, Supabase (`@supabase/ssr`), Vercel AI Gateway via the `ai` SDK, `qrcode`, `zod`. Tests with Vitest.

## Global Constraints

- **Next.js is 16.2.6 and diverges from training data** — read the relevant guide in `node_modules/next/dist/docs/` before writing route handlers or dynamic routes (per AGENTS.md). Dynamic route `params` are a **Promise** and must be awaited.
- **AI runs server-side only** via the Vercel AI Gateway; use a plain `"anthropic/claude-sonnet-4-6"` model string. Never expose keys to the browser. Read the `vercel:ai-sdk` skill before writing the enrich route.
- **Website is required to launch in both trial and paid modes.**
- **`advertiser`** in the campaign body is the AI-detected **company name**, not the campaign name.
- The link row and scan counts live in **this app's Supabase**, not kovio-api.
- Follow existing patterns: route handlers like `app/auth/callback/route.ts`; server Supabase via `lib/supabase/server.ts` (`createClient()` is async); browser Supabase via `lib/supabase/client.ts`.
- New env var: `AI_GATEWAY_API_KEY`.

---

### Task 0: Test tooling and dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `test/setup.ts`
- Create: `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs Vitest in node environment with `@` aliased to the repo root.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install ai qrcode zod
npm install -D vitest @vitejs/plugin-react @types/qrcode
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
```

- [ ] **Step 4: Create `test/setup.ts`**

```ts
// Reserved for global test setup. Intentionally empty for now.
export {};
```

- [ ] **Step 5: Create a smoke test `lib/__tests__/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('test tooling', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts test/setup.ts lib/__tests__/smoke.test.ts
git commit -m "chore: add vitest and brand-feature deps (ai, qrcode, zod)"
```

---

### Task 1: Extract shared category list

The wizard's `CATEGORIES` constant must be reused by the AI schema so the LLM can only return a valid category. Extract it to its own module.

**Files:**
- Create: `lib/categories.ts`
- Modify: `components/CampaignWizard.tsx` (remove local `CATEGORIES`, import it)
- Test: `lib/__tests__/categories.test.ts`

**Interfaces:**
- Produces:
  - `CATEGORIES: Array<[string, string]>` — `[value, label]` pairs (moved verbatim from the wizard).
  - `CATEGORY_KEYS: string[]` — just the values, e.g. `['food','beverage',...]`.
  - `categoryLabel(value: string): string` — value → label (moved from the wizard).

- [ ] **Step 1: Write the failing test `lib/__tests__/categories.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- categories`
Expected: FAIL — cannot resolve `@/lib/categories`.

- [ ] **Step 3: Create `lib/categories.ts`**

```ts
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
```

- [ ] **Step 4: Update `components/CampaignWizard.tsx` to use the shared module**

Remove the local `const CATEGORIES = [...]` array (lines ~24-42) and the local `categoryLabel` function (lines ~77-79). Add this import near the other imports at the top:
```ts
import { CATEGORIES, categoryLabel } from '@/lib/categories';
```
Leave all usages of `CATEGORIES` and `categoryLabel` in the component unchanged.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- categories && npx tsc --noEmit`
Expected: test PASS; `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/categories.ts lib/__tests__/categories.test.ts components/CampaignWizard.tsx
git commit -m "refactor: extract CATEGORIES to lib/categories"
```

---

### Task 2: Enrichment helpers (`lib/enrich.ts`)

Pure, I/O-free helpers: URL normalization, HTML→text extraction, and the Zod output schema.

**Files:**
- Create: `lib/enrich.ts`
- Test: `lib/__tests__/enrich.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_KEYS` from `@/lib/categories`.
- Produces:
  - `normalizeUrl(input: string): string | null` — trims, adds `https://` if no scheme, returns a valid absolute URL string or `null`.
  - `extractText(html: string, maxChars?: number): string` — strips `<script>`/`<style>`/tags, collapses whitespace, truncates to `maxChars` (default 8000).
  - `BrandSchema` — a Zod object: `{ company: string, category: enum(CATEGORY_KEYS), campaignName: string, summary: string }`.
  - `type Brand = z.infer<typeof BrandSchema>`.

- [ ] **Step 1: Write the failing test `lib/__tests__/enrich.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- enrich`
Expected: FAIL — cannot resolve `@/lib/enrich`.

- [ ] **Step 3: Create `lib/enrich.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- enrich && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/enrich.ts lib/__tests__/enrich.test.ts
git commit -m "feat: add enrich helpers (normalizeUrl, extractText, BrandSchema)"
```

---

### Task 3: QR helper (`lib/qr.ts`)

**Files:**
- Create: `lib/qr.ts`
- Test: `lib/__tests__/qr.test.ts`

**Interfaces:**
- Produces: `qrSvg(url: string): Promise<string>` — returns an inline `<svg>` string encoding `url`.

- [ ] **Step 1: Write the failing test `lib/__tests__/qr.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { qrSvg } from '@/lib/qr';

describe('qrSvg', () => {
  it('returns an svg string', async () => {
    const svg = await qrSvg('https://kovio.example/r/abc123');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
  it('produces different output for different urls', async () => {
    const a = await qrSvg('https://kovio.example/r/aaa');
    const b = await qrSvg('https://kovio.example/r/bbb');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- qr`
Expected: FAIL — cannot resolve `@/lib/qr`.

- [ ] **Step 3: Create `lib/qr.ts`**

```ts
import QRCode from 'qrcode';

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- qr`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/qr.ts lib/__tests__/qr.test.ts
git commit -m "feat: add qrSvg helper"
```

---

### Task 4: Supabase `campaign_links` table + scan RPC

Apply a migration to the remote Supabase project (project `acughqaekwknfowlntcl`, per memory) using the `mcp__supabase-new__apply_migration` tool. Memory notes RLS is currently off project-wide; this table ships **with** RLS and policies.

**Files:**
- Create: `supabase/migrations/20260620_campaign_links.sql` (committed copy of the applied SQL)

**Interfaces:**
- Produces a table `campaign_links` and an RPC `increment_scan(p_code text) returns text` (returns the `target_url`, or null if not found).

- [ ] **Step 1: Write the migration SQL `supabase/migrations/20260620_campaign_links.sql`**

```sql
create table if not exists public.campaign_links (
  code text primary key,
  target_url text not null,
  image_url text,
  campaign_id text,
  owner uuid not null default auth.uid(),
  scan_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.campaign_links enable row level security;

create policy "owner can insert" on public.campaign_links
  for insert with check (owner = auth.uid());
create policy "owner can select" on public.campaign_links
  for select using (owner = auth.uid());
create policy "owner can update" on public.campaign_links
  for update using (owner = auth.uid());

-- Public scan increment: SECURITY DEFINER so anonymous scanners can bump the
-- counter without a direct table grant. Returns the redirect target.
create or replace function public.increment_scan(p_code text)
returns text
language sql
security definer
set search_path = public
as $$
  update public.campaign_links
     set scan_count = scan_count + 1
   where code = p_code
  returning target_url;
$$;

grant execute on function public.increment_scan(text) to anon, authenticated;
```

- [ ] **Step 2: Apply the migration**

Use the `mcp__supabase-new__apply_migration` tool with `name: "campaign_links"` and the SQL above.

- [ ] **Step 3: Verify the table exists**

Use `mcp__supabase-new__list_tables` (schema `public`) and confirm `campaign_links` appears with the columns above. Also run `mcp__supabase-new__get_advisors` (type `security`) and confirm no new errors for this table.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260620_campaign_links.sql
git commit -m "feat: add campaign_links table and increment_scan rpc"
```

---

### Task 5: Link helpers (`lib/links.ts`)

Browser-side helpers to create a link row and attach a campaign id, plus a pure code generator.

**Files:**
- Create: `lib/links.ts`
- Test: `lib/__tests__/links.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`.
- Produces:
  - `genCode(bytes?: number): string` — short base62-ish id (default length 8), uses `crypto.getRandomValues`.
  - `createLink(input: { target_url: string; image_url: string | null }): Promise<{ code: string } | { error: string }>` — generates a code, inserts a row, returns the code.
  - `attachCampaign(code: string, campaignId: string): Promise<void>` — best-effort update; swallows errors.

- [ ] **Step 1: Write the failing test `lib/__tests__/links.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- links`
Expected: FAIL — cannot resolve `@/lib/links`.

- [ ] **Step 3: Create `lib/links.ts`**

```ts
'use client';

import { createClient } from '@/lib/supabase/client';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function genCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function createLink(input: {
  target_url: string;
  image_url: string | null;
}): Promise<{ code: string } | { error: string }> {
  const code = genCode(8);
  const supabase = createClient();
  const { error } = await supabase.from('campaign_links').insert({
    code,
    target_url: input.target_url,
    image_url: input.image_url,
  });
  if (error) return { error: error.message };
  return { code };
}

export async function attachCampaign(code: string, campaignId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('campaign_links').update({ campaign_id: campaignId }).eq('code', code);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- links`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/links.ts lib/__tests__/links.test.ts
git commit -m "feat: add link helpers (genCode, createLink, attachCampaign)"
```

---

### Task 6: Enrichment route (`app/api/enrich/route.ts`)

POST `{ url }` → auth-gated → fetch site → summarize with the AI Gateway → `{ company, category, campaignName, summary }`. Read the `vercel:ai-sdk` skill before implementing.

**Files:**
- Create: `app/api/enrich/route.ts`
- Test: `app/api/enrich/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `normalizeUrl`, `extractText`, `BrandSchema` from `@/lib/enrich`; `createClient` from `@/lib/supabase/server`; `generateObject` from `ai`.
- Produces: `POST(request: Request): Promise<Response>`. Responses:
  - `200 { company, category, campaignName, summary }` on success.
  - `400 { error }` for a missing/invalid URL.
  - `401 { error }` when no authenticated user.
  - `502 { error }` when the site fetch or the model call fails.

- [ ] **Step 1: Write the failing test `app/api/enrich/__tests__/route.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- enrich/__tests__`
Expected: FAIL — cannot resolve `@/app/api/enrich/route`.

- [ ] **Step 3: Create `app/api/enrich/route.ts`**

```ts
import { generateObject } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { normalizeUrl, extractText, BrandSchema } from '@/lib/enrich';

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let url: string | null = null;
  try {
    const body = await request.json();
    url = normalizeUrl(String(body?.url ?? ''));
  } catch {
    url = null;
  }
  if (!url) {
    return Response.json({ error: 'Enter a valid website URL.' }, { status: 400 });
  }

  let text: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'KovioBot/1.0 (+https://kovio.ai)' },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`status ${res.status}`);
    text = extractText(await res.text());
  } catch {
    return Response.json({ error: 'Could not reach that website.' }, { status: 502 });
  }

  try {
    const { object } = await generateObject({
      model: 'anthropic/claude-sonnet-4-6',
      schema: BrandSchema,
      prompt:
        'You are helping an advertiser set up a robot-fleet ad campaign. ' +
        'From the website text below, identify the company. Respond with the ' +
        'company name, the best-fit category, a short catchy campaign name, and ' +
        'a one-sentence summary of what they do.\n\nWEBSITE TEXT:\n' + text,
    });
    return Response.json(object, { status: 200 });
  } catch {
    return Response.json({ error: 'Could not analyze that website.' }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- enrich/__tests__ && npx tsc --noEmit`
Expected: all 4 tests PASS; no type errors.

- [ ] **Step 5: Document the env var**

Add to `.env` (and `.env.example` if present):
```
AI_GATEWAY_API_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add app/api/enrich/route.ts app/api/enrich/__tests__/route.test.ts .env.example
git commit -m "feat: add /api/enrich website summarization route"
```

---

### Task 7: Redirect route (`app/r/[code]/route.ts`)

GET → call `increment_scan` RPC → 302 to the returned `target_url`; unknown code → redirect home.

**Files:**
- Create: `app/r/[code]/route.ts`
- Test: `app/r/[code]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (RPC `increment_scan`).
- Produces: `GET(request: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response>` — 302 to target or to `/`.

- [ ] **Step 1: Write the failing test `app/r/[code]/__tests__/route.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- r/__tests__`
Expected: FAIL — cannot resolve `@/app/r/[code]/route`.

- [ ] **Step 3: Create `app/r/[code]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('increment_scan', { p_code: code });
  if (error || !data) {
    return NextResponse.redirect(`${origin}/`, 302);
  }
  return NextResponse.redirect(String(data), 302);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- r/__tests__`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/r/[code]/route.ts" "app/r/[code]/__tests__/route.test.ts"
git commit -m "feat: add /r/[code] tracked redirect route"
```

---

### Task 8: Hosted creative route (`app/creative/[code]/route.ts`)

GET → look up the link row → return an HTML page with the product image full-bleed and a QR overlay encoding the absolute `/r/[code]` URL.

**Files:**
- Create: `app/creative/[code]/route.ts`
- Test: `app/creative/[code]/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server` (select `image_url` from `campaign_links`); `qrSvg` from `@/lib/qr`.
- Produces: `GET(request, ctx: { params: Promise<{ code: string }> }): Promise<Response>` — `text/html`. Unknown code → minimal fallback HTML, status 404.

- [ ] **Step 1: Write the failing test `app/creative/[code]/__tests__/route.test.ts`**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- creative/__tests__`
Expected: FAIL — cannot resolve `@/app/creative/[code]/route`.

- [ ] **Step 3: Create `app/creative/[code]/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server';
import { qrSvg } from '@/lib/qr';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaign_links')
    .select('image_url')
    .eq('code', code)
    .maybeSingle();

  if (!data) {
    return new Response('<!doctype html><title>Not found</title><body></body>', {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  const svg = await qrSvg(`${origin}/r/${code}`);
  const image = data.image_url ?? '';
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%;background:#000}
  .stage{position:relative;width:100vw;height:100vh;overflow:hidden}
  .art{width:100%;height:100%;object-fit:cover}
  .qr{position:absolute;right:4%;bottom:4%;width:22%;max-width:280px;
      background:#fff;padding:2.2%;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
  .qr svg{display:block;width:100%;height:auto}
  .scan{margin-top:6px;text-align:center;font:600 14px system-ui,sans-serif;color:#111}
</style></head>
<body><div class="stage">
  ${image ? `<img class="art" src="${image}" alt="">` : ''}
  <div class="qr">${svg}<div class="scan">Scan me</div></div>
</div></body></html>`;

  return new Response(html, { status: 200, headers: HTML_HEADERS });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- creative/__tests__ && npx tsc --noEmit`
Expected: both tests PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add "app/creative/[code]/route.ts" "app/creative/[code]/__tests__/route.test.ts"
git commit -m "feat: add /creative/[code] hosted QR creative route"
```

---

### Task 9: Campaign draft helper (`lib/campaign-draft.ts`)

Extract the launch-body construction into a pure, testable function so the wizard's new wiring (company name as advertiser, hosted creative URL) is covered by tests.

**Files:**
- Create: `lib/campaign-draft.ts`
- Test: `lib/__tests__/campaign-draft.test.ts`

**Interfaces:**
- Consumes: `slugify`, `rand` (re-declared locally — they are tiny and currently private to the wizard).
- Produces:
  - `creativeUrlFor(origin: string, code: string): string` → `${origin}/creative/${code}`.
  - `buildCampaignBody(args): CreateCampaignBody` where `args` is
    `{ draft: { name; company; category; budget; start; duration; code }, mode: 'trial' | 'paid', origin: string }`.
    Uses `company` for `advertiser`, the hosted creative URL for `creative_url`, trial → 7 days / 50000 cents.

- [ ] **Step 1: Write the failing test `lib/__tests__/campaign-draft.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { creativeUrlFor, buildCampaignBody } from '@/lib/campaign-draft';

const base = {
  name: 'Summer Launch', company: 'Acme Inc', category: 'retail',
  budget: '500', start: '2026-07-01', duration: 14, code: 'XyZ12345',
};

describe('creativeUrlFor', () => {
  it('builds the hosted creative url', () => {
    expect(creativeUrlFor('https://app.kovio.ai', 'abc')).toBe('https://app.kovio.ai/creative/abc');
  });
});

describe('buildCampaignBody', () => {
  it('uses company as advertiser and the hosted creative url', () => {
    const body = buildCampaignBody({ draft: base, mode: 'paid', origin: 'https://app.kovio.ai' });
    expect(body.advertiser).toBe('Acme Inc');
    expect(body.creative_url).toBe('https://app.kovio.ai/creative/XyZ12345');
    expect(body.name).toBe('Summer Launch');
    expect(body.category).toBe('retail');
    expect(body.budget_total_cents).toBe(50000);
    expect(body.campaign_id.startsWith('summer-launch-')).toBe(true);
  });

  it('forces 7 days and 50000 cents in trial mode', () => {
    const body = buildCampaignBody({ draft: base, mode: 'trial', origin: 'https://app.kovio.ai' });
    expect(body.budget_total_cents).toBe(50000);
    const days = (new Date(body.end_at!).getTime() - new Date(body.start_at).getTime()) / 86400000;
    expect(Math.round(days)).toBe(7);
  });

  it('falls back to Brand when company is empty', () => {
    const body = buildCampaignBody({ draft: { ...base, company: '' }, mode: 'paid', origin: 'https://x' });
    expect(body.advertiser).toBe('Brand');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- campaign-draft`
Expected: FAIL — cannot resolve `@/lib/campaign-draft`.

- [ ] **Step 3: Create `lib/campaign-draft.ts`**

```ts
import type { CreateCampaignBody } from '@/lib/api-client';

export interface DraftCore {
  name: string;
  company: string;
  category: string;
  budget: string;
  start: string; // yyyy-mm-dd
  duration: number;
  code: string;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campaign';
}
function rand(n: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function creativeUrlFor(origin: string, code: string): string {
  return `${origin}/creative/${code}`;
}

export function buildCampaignBody(args: {
  draft: DraftCore;
  mode: 'trial' | 'paid';
  origin: string;
}): CreateCampaignBody {
  const { draft, mode, origin } = args;
  const days = mode === 'trial' ? 7 : draft.duration;
  const startMs = new Date(draft.start + 'T00:00:00').getTime();
  const endIso = new Date(startMs + days * 86400000).toISOString();
  return {
    campaign_id: `${slugify(draft.name)}-${rand(4).toLowerCase()}`,
    name: draft.name.trim() || 'Untitled campaign',
    advertiser: draft.company.trim() || 'Brand',
    creative_url: creativeUrlFor(origin, draft.code),
    targeting: [{ field: 'person_count', op: '>=', value: 1 }],
    priority: 10,
    encounter_cap_seconds: 300,
    category: draft.category,
    budget_total_cents: mode === 'trial' ? 50000 : Number(draft.budget) * 100,
    cost_per_impression_cents: 10,
    cost_per_attended_cents: 5,
    start_at: new Date(draft.start + 'T00:00:00').toISOString(),
    end_at: endIso,
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- campaign-draft && npx tsc --noEmit`
Expected: all tests PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/campaign-draft.ts lib/__tests__/campaign-draft.test.ts
git commit -m "feat: add buildCampaignBody/creativeUrlFor draft helpers"
```

---

### Task 10: Wizard Brand step + launch wiring

Add the Brand step to `CampaignWizard.tsx`: website input, AI fetch, editable result, required-to-continue gating, link-row creation at the creative step, and launch rewiring through `buildCampaignBody` + `attachCampaign`.

**Files:**
- Modify: `components/CampaignWizard.tsx`
- Test: `lib/__tests__/brand-step.test.ts` (pure gating helper, exported from the wizard module is awkward; instead put the helper in `lib/campaign-draft.ts`)

**Interfaces:**
- Consumes: `buildCampaignBody`, `creativeUrlFor` from `@/lib/campaign-draft`; `createLink`, `attachCampaign` from `@/lib/links`; `normalizeUrl` from `@/lib/enrich`; `brandStepReady` (added below).
- Produces: the running wizard. Adds `brandStepReady(draft): boolean` to `lib/campaign-draft.ts`.

- [ ] **Step 1: Write the failing test `lib/__tests__/brand-step.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- brand-step`
Expected: FAIL — `brandStepReady` is not exported.

- [ ] **Step 3: Add `brandStepReady` to `lib/campaign-draft.ts`**

Add this import at the top of `lib/campaign-draft.ts`:
```ts
import { normalizeUrl } from '@/lib/enrich';
```
And append:
```ts
export function brandStepReady(draft: { website: string; company: string }): boolean {
  return normalizeUrl(draft.website) !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- brand-step`
Expected: PASS.

- [ ] **Step 5: Extend the `Draft` interface and initial state in `components/CampaignWizard.tsx`**

In the `Draft` interface (after `name`), add:
```ts
  website: string;
  company: string;
  summary: string;
  code: string;
```
In the `useState<Draft>` initializer (after `name: ''`), add:
```ts
    website: '',
    company: '',
    summary: '',
    code: '',
```
Add an enrichment UI state near the other `useState` calls:
```ts
  const [enriching, setEnriching] = useState(false);
  const [enrichErr, setEnrichErr] = useState('');
```

- [ ] **Step 6: Add the new imports to `components/CampaignWizard.tsx`**

```ts
import { buildCampaignBody } from '@/lib/campaign-draft';
import { brandStepReady } from '@/lib/campaign-draft';
import { createLink, attachCampaign } from '@/lib/links';
```
(Combine the two `campaign-draft` imports into one line if preferred.)

- [ ] **Step 7: Add the step to both flows**

Change the step arrays:
```ts
  const stepKeys = mode === 'trial'
    ? ['brand', 'setup', 'creative', 'review']
    : ['brand', 'details', 'creative', 'payment', 'review'];
  const stepLabels = mode === 'trial'
    ? ['Brand', 'Setup', 'Creative', 'Review']
    : ['Brand', 'Details', 'Creative', 'Payment', 'Review'];
```

- [ ] **Step 8: Add the enrich handler and continue-gating**

Add this function inside the component (near `next`/`back`):
```ts
  async function runEnrich() {
    setEnrichErr('');
    setEnriching(true);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: draft.website }),
      });
      const body = await res.json();
      if (!res.ok) {
        setEnrichErr(body?.error ?? 'Could not analyze that website.');
      } else {
        setDraft((d) => ({
          ...d,
          company: body.company ?? d.company,
          category: body.category ?? d.category,
          name: d.name || (body.campaignName ?? ''),
          summary: body.summary ?? '',
        }));
      }
    } catch {
      setEnrichErr('Could not analyze that website.');
    } finally {
      setEnriching(false);
    }
  }
```
In `next()`, block leaving the brand step until a website is present:
```ts
  function next() {
    if (stepKey === 'brand' && !brandStepReady(draft)) {
      setEnrichErr('Enter your website to continue.');
      return;
    }
    if (isFinal) launch();
    else setStep((s) => Math.min(stepKeys.length, s + 1));
  }
```

- [ ] **Step 9: Render the Brand step**

Add this block alongside the other `stepKey === '…'` blocks (place it before the `setup` block):
```tsx
          {/* BRAND */}
          {stepKey === 'brand' && (
            <>
              <div className="mb-[22px] font-mono text-[13px] uppercase tracking-[0.14em] text-faint">Your brand</div>
              <label className={labelCls}>Company website</label>
              <div className="flex gap-2.5">
                <input
                  value={draft.website}
                  onChange={(e) => set('website', e.target.value)}
                  onBlur={() => brandStepReady(draft) && !draft.company && runEnrich()}
                  placeholder="acme.com"
                  autoFocus
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={runEnrich}
                  disabled={enriching || !brandStepReady(draft)}
                  className="rounded-[11px] bg-accent px-5 py-4 text-[16px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                >
                  {enriching ? 'Reading…' : 'Fetch details'}
                </button>
              </div>
              <p className="mt-2 text-[14px] text-muted">We&apos;ll scan your site to pre-fill the rest and add a scannable QR to your ad.</p>

              {draft.company && (
                <div className="mt-6 rounded-[14px] border border-tint-line bg-tint px-5 py-[18px]">
                  <div className="text-[13px] font-mono uppercase tracking-[0.12em] text-accent-dark/70">We found you</div>
                  <label className={`${labelCls} mt-3`}>Company name</label>
                  <input value={draft.company} onChange={(e) => set('company', e.target.value)} className={`${inputCls} mb-3`} />
                  {draft.summary && <p className="text-[15px] text-accent-dark/80">{draft.summary}</p>}
                </div>
              )}

              {enrichErr && <p className="mt-3 text-sm text-danger">{enrichErr}</p>}
              <div className="mt-[30px]"><Footer /></div>
            </>
          )}
```

- [ ] **Step 10: Create the link row when entering the Creative step**

Replace the body of `next()` step-advance so that, when moving **into** the creative step, a link row is created if one doesn't exist yet. Update `next()`:
```ts
  async function next() {
    if (stepKey === 'brand' && !brandStepReady(draft)) {
      setEnrichErr('Enter your website to continue.');
      return;
    }
    if (isFinal) { launch(); return; }
    const nextKey = stepKeys[step]; // step is 1-based; stepKeys[step] is the next key
    if (nextKey === 'creative' && !draft.code) {
      const made = await createLink({ target_url: draft.website, image_url: draft.creative || null });
      if ('code' in made) set('code', made.code);
    }
    setStep((s) => Math.min(stepKeys.length, s + 1));
  }
```
(The `import { normalizeUrl }` already used via `brandStepReady`; the raw website string is fine as `target_url` — it is normalized at redirect time only for display, but store the user value. If you prefer a normalized target, call `normalizeUrl(draft.website) ?? draft.website`.)

- [ ] **Step 11: Rewire `launch()` to use the helper and attach the campaign**

Replace the existing `launch()` body's `body` construction and post-create logic with:
```ts
  async function launch() {
    setLoading(true);
    setError('');
    const origin = window.location.origin;
    const body = buildCampaignBody({
      draft: {
        name: draft.name, company: draft.company, category: draft.category,
        budget: draft.budget, start: draft.start, duration: draft.duration, code: draft.code,
      },
      mode,
      origin,
    });
    const { data, error } = await apiClient.createCampaign(body);
    if (error) {
      setLoading(false);
      setError(error.detail ?? 'Could not launch the campaign. Please try again.');
      return;
    }
    if (data?.id && draft.code) await attachCampaign(draft.code, data.id);
    router.push(data?.id ? `/campaigns/${data.id}` : '/dashboard');
    router.refresh();
  }
```
Remove the now-unused local `slugify`/`rand` helpers from the wizard **only if** no other code in the file references them (the calendar/format code does not). Keep `fmt`, `todayISO`, `categoryLabel` import, etc.

- [ ] **Step 12: Update the Creative-step preview to show the hosted creative (optional but recommended)**

In the `stepKey === 'creative'` block, when `draft.code` exists, render the hosted creative in an iframe so the user sees the QR:
```tsx
              {draft.code ? (
                <iframe
                  title="Creative preview"
                  src={`/creative/${draft.code}`}
                  className="mb-[22px] h-[340px] w-full rounded-[12px] border-2 border-dashed border-line-strong"
                />
              ) : (
                <div className="mb-[22px]"><CreativeBox h={340} /></div>
              )}
```
(Leave the existing image-URL input; when the user edits it, the link row's `image_url` is already set from the value captured at step entry. For a v1 this is acceptable; updating the row live is out of scope.)

- [ ] **Step 13: Run the full test suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS; no type errors.

- [ ] **Step 14: Manual verification**

Run: `npm run dev`. Then:
1. Go to the create-campaign page. Confirm step 1 is **Brand** in both Free and Custom modes.
2. Enter a real website (e.g. `stripe.com`), click **Fetch details**. Confirm company/summary populate and category/name carry forward. (Requires `AI_GATEWAY_API_KEY` set.)
3. Try to continue with an empty website — confirm it's blocked.
4. Advance to **Creative** — confirm the iframe preview renders the image with a QR overlay.
5. Open `/creative/<code>` directly and `/r/<code>` — confirm the redirect lands on the website and `scan_count` increments (check via `mcp__supabase-new__execute_sql`: `select code, scan_count from campaign_links order by created_at desc limit 5;`).
6. Launch and confirm the campaign's `advertiser` is the company name and `creative_url` points at `/creative/<code>`.

- [ ] **Step 15: Commit**

```bash
git add components/CampaignWizard.tsx lib/campaign-draft.ts lib/__tests__/brand-step.test.ts
git commit -m "feat: brand step with AI auto-fill and QR creative wiring in wizard"
```

---

## Self-Review

**Spec coverage:**
- Brand step (UX section) → Task 10. ✓
- Enrichment route + AI Gateway → Task 6. ✓
- `campaign_links` table + scan RPC → Task 4. ✓
- Redirect `/r/[code]` → Task 7. ✓
- Hosted creative `/creative/[code]` → Task 8. ✓
- `lib/enrich`, `lib/qr`, `lib/links` isolated modules → Tasks 2, 3, 5. ✓
- Launch wiring (advertiser=company, creative_url=hosted) → Task 9 + Task 10. ✓
- Required website both modes → Task 10 (`brandStepReady` gating). ✓
- Error handling (timeout, invalid URL, enum constraint, missing code) → Tasks 2, 6, 7, 8. ✓
- Deps `ai`/`qrcode`/`zod`, env `AI_GATEWAY_API_KEY` → Task 0, Task 6. ✓
- Category enum shared between wizard and schema → Task 1. ✓

**Out of scope (per spec):** scan_count on the report page; persistent brand profile; AI-generated imagery. Not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `buildCampaignBody`/`creativeUrlFor`/`brandStepReady` signatures match between Tasks 9, 10 and their tests; `increment_scan(p_code)` param name matches between Task 4 SQL and Task 7 call; `campaign_links` columns match between Tasks 4, 5, 8. ✓
