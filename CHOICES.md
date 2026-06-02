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

---

## Redesign (marketing aesthetic) — decisions & deviations

- **Tailwind v4, not v3.** The prompt's Step 1/2 assumed a `tailwind.config.ts` with `theme.extend`. This project is on Tailwind **v4** (CSS-based). Tokens were ported to `@theme` in `app/globals.css` (same color/font/font-size names → same utilities: `bg-page`, `text-ink`, `text-display`, `font-serif`, etc.). No config file exists or is needed.
- **Font variable names.** next/font uses `--font-sans-src` / `--font-serif-src` / `--font-mono-src`; `@theme` maps the semantic tokens to them with fallbacks (avoids a self-referential `var(--font-sans)` cycle).
- **Client pages → server shell + client island.** `AppShell`/`Sidebar` are async server components, so client pages can't import them directly. `/campaigns/new` and `/deposit` are server pages that render `AppShell` + a client island (`NewCampaignForm`, `DepositForm`). `/login` and `/onboarding` stay shell-less client pages.
- **OEM onboarding disabled.** The "Fleet operator" choice is shown but disabled ("coming soon") — there's no OEM onboarding endpoint and the spec forbids new frontend endpoints. Only the Brand (advertiser) path calls `apiClient.onboard`.
- **Range pills are presentational.** `?range=` updates the URL but the `/dashboard` endpoint doesn't filter by range yet, so the data is unchanged. Wire when the backend accepts a range param.
- **Placeholder metrics (show `—` + TODO):** engagement rate, QR scans, avg dwell, environment mix, and multi-day chart history — none are in the current `/advertiser/v1/dashboard` response. Sparklines/charts use the last ~10 `recent_impressions` grouped by day, so they fill in as data accrues.
- **Live activity feed** maps `recent_impressions` (no per-event location/time in the API, so location shows "Across active fleet").
- **Sidebar bid-balance %** = spent_30d / (spent_30d + balance) — an approximation until a true budget figure is exposed.
- **Deploy:** via `git push` → Vercel Git integration (the Vercel CLI can't auth from this sandbox — keychain isolation), not `vercel --prod`.

---

## OEM portal (milestone)

- **Reused the existing component library** (Sidebar, AppShell, SectionHeader, MetricCard, Pill, Chart/ChartClient, Table, LiveActivityFeed) — no new shared UI components. New client islands only for interactivity: `NewFleetForm`, `FleetApiKeys`, `FleetBrandSafety`, `FleetEditButton`.
- **Sidebar is now kind-aware**: tries `api.me()`; on 403 `wrong_user_kind` falls through to `api.oemMe()`. Advertiser → rust avatar + Bid balance card; OEM → navy avatar + Pending payout card. Nav branches accordingly.
- **Chart format passed as string key** (`primaryFormat="usd"`), never a function — functions can't cross the server→client boundary (that was the earlier 500). Charts loaded via `ChartClient` (ssr:false).
- **OEM dashboard chart is single-series** (revenue only); `Chart` already supports omitting `secondaryKey`.
- **Verified authenticated renders locally before deploying**: forged Supabase sessions (HS256, local-test-secret) for both an OEM and an advertiser user against the local API, with a temporary env-gated proxy bypass (`KOVIO_LOCAL_BYPASS_AUTH`, reverted before commit). All OEM + advertiser pages returned 200.
- **API-key secrets**: only ever in the mint POST response; the reveal panel shows it once, then the list shows prefix-only.
- **Cross-kind nav**: root page + sidebar route by kind. An OEM directly visiting an advertiser route still renders (empty data) rather than 403 — acceptable; the normal flows route correctly.
- **Deploy via `git push`** (Vercel Git integration); CLI unusable from sandbox.
