# kovio-web — build choices & open items

Autonomous build of the Kovio advertiser web app. This documents non-obvious
decisions, deviations, and what still needs a human.

## Non-obvious decisions

- **Next.js 16, not 14.** The prompt's stack said "Next 14" but its literal
  command used `create-next-app@latest`, which installed **Next 16.2.6** + React
  19 + Tailwind v4. I followed the command and adapted to Next 16 conventions
  (below). The App Router code is otherwise as specified.
- **`middleware.ts` → `proxy.ts`.** Next 16 renamed the middleware file
  convention to `proxy` (the `middleware` name is deprecated). The root file is
  `proxy.ts` exporting `proxy()`; behavior/matcher are identical. The internal
  helper stays at `lib/supabase/middleware.ts`.
- **Async `params` / `cookies()`.** Next 16 fully removed sync access. The
  `[id]` page awaits `params: Promise<{id}>`; the server Supabase client awaits
  `cookies()`.
- **Supabase anon key = legacy HS256 key.** `get_publishable_keys` returned both
  a legacy `anon` JWT and a modern `sb_publishable_...` key. Used the legacy
  `anon` key for `NEXT_PUBLIC_SUPABASE_ANON_KEY` (canonical, maximally
  compatible with `@supabase/ssr`). Its `alg:HS256` also confirms the project
  signs JWTs with the shared HS256 secret — matching `kovio-cloud`'s
  `supabase_auth.py` verifier.
- **No `next/font`.** Dropped the scaffold's Geist Google-font import to avoid a
  build-time network fetch; using system fonts via Tailwind defaults.
- **`turbopack.root` pinned** in `next.config.ts` — a stray `~/package-lock.json`
  on this machine otherwise made Turbopack infer the wrong workspace root.
- **Money input units.** Budget and deposit are entered in **USD** and converted
  to cents (×100). Cost-per-impression / cost-per-attended are entered directly
  in **cents** (the backend's native unit, e.g. `10` = $0.10/impression).
- **Campaigns table "CPM" column** is labeled **"Cost / impr"** — it shows the
  per-impression cost (`cost_per_impression_cents`), which is what the backend
  actually charges, not a true cost-per-mille.
- **Targeting presets** map to backend rule objects: morning →
  `{hour_of_day, between, [6,11]}`, evening → `[17,21]`, person-watching →
  `{person_count, >=, 1}`.
- **Deposit presets**: $25 / $100 / $500, plus a custom USD field. Backend caps
  a single deposit at $10,000.

## Errors encountered & resolved

- Initial `Write` of `layout.tsx`/`page.tsx` failed because the scaffold already
  created them — read then overwrote. No code impact.
- Multi-lockfile Turbopack warning → fixed via `turbopack.root`.

## Verified (headless)

- `npm run build` → exit 0, TypeScript clean, all 11 routes compiled.
- `/login` → 200; `/`, `/dashboard`, `/campaigns` (unauthenticated) → 307 →
  `/login` (single redirect, no loop).

## NOT auto-completed — needs you

- **Vercel deploy (Step 9) — NOT DONE.** The Vercel CLI isn't authenticated
  (`vercel login` is browser-interactive). Run, from `kovio-web/`:
  ```bash
  vercel login
  vercel link --yes --project kovio-web
  vercel env add NEXT_PUBLIC_SUPABASE_URL production       # paste from .env.local
  vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production  # paste from .env.local
  vercel env add NEXT_PUBLIC_KOVIO_API_URL production      # https://kovio-api.fly.dev
  vercel --prod --yes
  ```
- **Custom domain `app.kovio.dev` (Step 10) — NOT DONE.** After deploy:
  `vercel domains add app.kovio.dev` then add the CNAME (`app` →
  `cname.vercel-dns.com`) at your DNS provider.
- **Supabase Auth redirect URLs** — Dashboard → Authentication → URL
  Configuration. Site URL `https://app.kovio.dev`; Redirect URLs:
  `https://app.kovio.dev/auth/callback`,
  `https://kovio-web.vercel.app/auth/callback`,
  `http://localhost:3000/auth/callback`. Without this, magic links won't redirect.
- **Verify the Fly `KOVIO_SUPABASE_JWT_SECRET`** matches the Supabase JWT secret
  exactly. If API calls 401 after a successful login, the secret is wrong —
  re-set it with single quotes / `pbpaste` to avoid shell `$`-expansion:
  `fly secrets set KOVIO_SUPABASE_JWT_SECRET='<paste>' --app kovio-api`.

## Deployment status

- Vercel URL: **not deployed yet** (see above).
- `app.kovio.dev`: **pending** Vercel deploy + DNS.
