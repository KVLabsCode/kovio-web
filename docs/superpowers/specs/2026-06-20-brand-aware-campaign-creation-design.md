# Brand-aware campaign creation — Design

**Date:** 2026-06-20
**Status:** Approved (brainstorming) — ready for implementation plan
**Branch:** onboarding-redesign

## Summary

Add a website-driven, AI-assisted onramp to the create-campaign flow. The
advertiser pastes their website; we fetch it server-side, summarize it with an
LLM, and pre-fill the campaign setup (company name, category, suggested campaign
name, one-line summary). We generate a tracked QR code and composite it onto a
Kovio-hosted creative so people can scan the physical robot ad and land on the
advertiser's site, with per-campaign scan counts.

The web app is otherwise a thin frontend over an external `kovio-api`. All new
backend behavior here lives in this repo: Next.js route handlers plus a Supabase
table. We are **not** extending `kovio-api`.

## Decisions (locked during brainstorming)

1. **AI purpose:** auto-fill the campaign setup only (company, category,
   campaign name, summary). Not generating the creative, not a stored brand
   profile.
2. **Where AI runs:** a Next.js route handler in this repo, using the Vercel AI
   Gateway via the AI SDK. Keys stay server-side.
3. **QR target:** a tracked redirect link (`/r/[code]`) so scans are counted per
   campaign, then 302 to the advertiser's website.
4. **QR rendering:** a Kovio-hosted HTML creative (a Next route) that composites
   the advertiser's image + QR overlay; that route's URL is passed as
   `creative_url`. Leverages existing `.html` creative support.
5. **Required:** website is required to launch in **both** trial and paid modes,
   so the QR is always present.

## User experience

A new **"Brand"** step becomes step 1 in both modes:

- **Trial:** Brand → Setup → Creative → Review
- **Paid:** Brand → Details → Creative → Payment → Review

**Brand step:**

- Single website URL input plus a "Fetch details" action that also fires on blur.
- On submit: call the enrichment route, show a loading shimmer, then reveal an
  editable "We found you" card pre-filled with **company name**, **category**
  (mapped to the existing `CATEGORIES` enum in `CampaignWizard.tsx`), a
  **suggested campaign name**, and a **one-line summary**. All editable.
- Website is **required** to continue. If AI enrichment fails, the user can type
  the company name manually, but the URL must still be present (needed for the QR).

Downstream, Setup/Details arrive pre-populated, so they read as "confirm and go."
The **Creative** step preview shows the real hosted creative with the QR
composited in (rendered via an `<iframe>` of `/creative/[code]`).

## Architecture

### New modules (isolated, independently testable)

- **`lib/enrich.ts`** — pure helpers: `normalizeUrl(input)` (prefix `https://`,
  validate), `extractText(html)` (strip tags/script/style, collapse whitespace,
  cap length), and the Zod output schema. No I/O.
- **`lib/qr.ts`** — `qrSvg(url): string` using the `qrcode` lib (`toString`,
  type `svg`). No I/O.
- **`lib/links.ts`** — Supabase helpers: `createLink({ target_url, image_url })
  → { code }`, `attachCampaign(code, campaignId)`, and the increment used by the
  redirect route (via RPC). `genCode()` produces a short base62 id.

Route handlers orchestrate these; they hold no business logic of their own.

### Route handlers

1. **`app/api/enrich/route.ts`** (POST, auth-gated via `lib/supabase/server`)
   - Body `{ url }`. Normalize the URL.
   - Fetch the site HTML server-side: follow redirects, ~8s timeout, size cap,
     reasonable User-Agent. Strip to text via `extractText`.
   - Call the Vercel AI Gateway through the AI SDK using `generateObject` with a
     Zod schema:
     `{ company: string, category: enum(CATEGORIES keys), campaignName: string, summary: string }`.
     Model: `anthropic/claude-sonnet-4-6`.
   - Return the structured JSON. On fetch/LLM failure return a soft error the
     wizard can recover from (manual entry path).
   - **Read the AI SDK guidance (vercel:ai-sdk skill) before implementing this route.**

2. **`app/r/[code]/route.ts`** (GET, public)
   - Look up `code`; increment `scan_count` via a `SECURITY DEFINER` RPC so the
     public scan can bump the counter under RLS; 302-redirect to `target_url`.
   - Missing code → 404 / redirect home.

3. **`app/creative/[code]/route.ts`** (GET, public)
   - Look up `code`; return an HTML page: full-bleed product image (`image_url`)
     with a QR overlay in a corner. QR encodes the **absolute** `/r/[code]` URL,
     rendered as inline SVG via `lib/qr.ts`. Returned as `text/html`.
   - This URL is what the fleet renders and what we pass as `creative_url`.

### Data model — Supabase table `campaign_links`

| column        | type          | notes                                  |
| ------------- | ------------- | -------------------------------------- |
| `code`        | text PK       | short base62 id                        |
| `target_url`  | text not null | the advertiser's website               |
| `image_url`   | text          | advertiser's creative image (nullable) |
| `campaign_id` | text          | null until launch                      |
| `owner`       | uuid          | auth user, for RLS                     |
| `scan_count`  | int default 0 | bumped by the redirect RPC             |
| `created_at`  | timestamptz   | default now()                          |

RLS: owner can insert/select/update their rows. A `SECURITY DEFINER`
`increment_scan(code)` RPC performs the public scan increment. (Note: repo memory
says RLS is currently off on the new Supabase project — confirm policy at
implementation time and enable for this table.)

## Data flow

```
Website ─▶ /api/enrich ─▶ {company, category, campaignName, summary} ─▶ draft
Creative step ─▶ createLink {code, target_url, image_url} ─▶ draft.code
Launch ─▶ creative_url = `${origin}/creative/${code}`,  advertiser = company
        ─▶ createCampaign() ─▶ attachCampaign(code, campaign.id)
Scan ─▶ robot shows QR ─▶ /r/{code} ─▶ +1 scan_count ─▶ 302 to website
```

## Wizard changes (`components/CampaignWizard.tsx`)

- Add a `brand` step at the front of both `stepKeys`/`stepLabels` arrays.
- Extend `Draft` with `website`, `company`, `summary`, and `code` (the link
  code), plus an enrichment status/error for the Brand step UI.
- Brand step UI: URL input, fetch action, loading shimmer, editable result card.
  Block `next()` from the brand step until a valid website is present.
- Category/name fields read their defaults from enrichment results; still editable.
- Create the `campaign_links` row when the user reaches the Creative step
  (target_url = website, image_url = pasted image), storing `code` in the draft.
- `launch()`:
  - `creative_url = `${window.location.origin}/creative/${draft.code}``
  - `advertiser = draft.company` (was the campaign name)
  - after `createCampaign` succeeds, `attachCampaign(draft.code, data.id)`.

## Error handling

- Enrich timeout / unreachable / LLM failure → soft error; manual company entry;
  website preserved (QR still works).
- Invalid URL → normalized client-side (`https://` prefix) and validated.
- LLM category outside the enum → constrained by the Zod enum schema.
- Redirect for missing code → 404 / home.
- Creative route for missing code → minimal fallback page (no broken render).

## Testing (TDD)

- **Pure helpers:** `normalizeUrl`, `extractText`, `genCode` (shape/uniqueness),
  `qrSvg` returns an `<svg>` containing the encoded URL.
- **`/api/enrich`:** mocked `fetch` + mock model → returns structured fields;
  failure paths return soft error.
- **`/r/[code]`:** increments `scan_count` and 302s to `target_url`; unknown code
  handled.
- **`/creative/[code]`:** returns HTML containing an `<svg>` QR and the image;
  QR encodes the absolute `/r/[code]` URL.
- **Wizard:** enrichment populates fields; cannot continue from Brand without a
  website; launch wires `creative_url`/`advertiser` and attaches `campaign_id`.

## Dependencies & environment

- **New deps:** `ai` (AI SDK v6), `qrcode` (+ `@types/qrcode`), `zod` (not
  currently present).
- **New env:** `AI_GATEWAY_API_KEY` (Vercel AI Gateway). Document in `.env`.

## Implementation notes

- This Next.js is 16.2.6 and AGENTS.md warns it diverges from training data —
  read the relevant guide in `node_modules/next/dist/docs/` before writing route
  handlers / dynamic routes.
- Existing route handlers for reference: `app/auth/logout/route.ts`,
  `app/auth/callback/route.ts`. Server Supabase client: `lib/supabase/server.ts`.

## Out of scope (follow-ons)

- Surfacing `scan_count` on the campaign report page (`app/campaigns/[id]/report`).
- Persisting the brand profile for reuse across campaigns.
- AI-generated creative imagery.
