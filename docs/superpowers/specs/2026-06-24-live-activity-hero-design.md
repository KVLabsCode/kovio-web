# Live Activity Hero — Design Spec

**Date:** 2026-06-24
**Branch:** `koushiks-branch` (kovio-web)
**Status:** Approved (design), pending implementation plan

## Goal

Add a prominent "Live Activity" hero to the **top of the advertiser trial dashboard**
(the `campaigns.length === 0` first-login view). It plays short cinematic clips of
the Kovio robot fleet running ads in high-foot-traffic locations, plus a "Going live
June 29" timeline banner. The psychological intent: a new advertiser who clicks the
email link sees, immediately, that real robots are about to run — motivating them to
upload creative and get in the queue before the fleet goes live.

## Scope

- **In:** A self-contained, purely-visual hero on the trial view only. Manifest-driven
  video carousel. Timeline banner with date + countdown. Graceful placeholder when no
  clips exist. Reduced-motion + missing-file fallbacks. Unit tests for the pure helpers.
- **Out:** The active overview (advertisers with campaigns) is unchanged. No clicks,
  drill-down, analytics, or advertiser branding. No backend changes — clips are static
  assets the user provides.

## Placement & tradeoff

The hero renders at the very top of the trial branch in `app/dashboard/page.tsx`,
**above** the "Good evening, {brand}" greeting. This **supersedes** the earlier
"trial view fits without scrolling" goal for this view: the hero is the above-the-fold
focus and the Getting Started + Plan cards move below it (a short scroll is acceptable).
The active overview keeps its existing layout (no hero).

## Components

### `components/LiveActivityHero.tsx` (client component)
Owns playback, crossfade, auto-advance, and all fallbacks. Client because it manages
`<video>` elements, rotation timers, and a client-only countdown.

### `lib/fleet-clips.ts` (manifest + constants)
The single source of truth the user edits:

```ts
export type FleetClip = { src: string; location: string; poster?: string };

// Fleet activation date (advertiser-facing). Hardcoded for the launch push.
export const FLEET_GO_LIVE = '2026-06-29';

export const FLEET_CLIPS: FleetClip[] = [
  // Drop matching MP4s into public/videos/. Empty array => placeholder hero.
  // { src: '/videos/market-street.mp4', location: 'Market Street · San Francisco', poster: '/videos/market-street.jpg' },
];
```

Clips live in `public/videos/`. An empty `FLEET_CLIPS` (the initial committed state)
renders the placeholder hero, so the feature ships without assets and never looks broken.

### `lib/fleet-clips` helper: `daysUntil(dateISO, now)`
Pure function returning whole days from `now` to `dateISO` (floored, min 0). Used by the
banner countdown and unit-tested. Kept pure (takes `now`) so tests are deterministic.

## Player behavior

- Two stacked `<video autoplay muted loop playsInline preload="metadata">` layers (A/B)
  for seamless crossfade.
- Advance to the next clip on the `ended` event, or after a 30s safety cap, whichever is
  first. Crossfade via opacity transition (~600ms); the set loops forever.
- `muted` is required for browser autoplay; `playsInline` prevents iOS fullscreen.
- Purely visual: no controls, no pointer interaction anywhere in the hero.

## Overlays (cinematic, authentic — no advertiser branding)

- **Top-left:** pulsing `LIVE` badge (reuse `.k-pulse`) + "Kovio fleet" label.
- **Bottom-left:** current **location label**, fades/slides on clip change.
- **Bottom-center:** **indicator dots**, one per clip, highlighting the active index.
  Non-interactive (presentational only) — they show position, not affordance.
- **Treatment:** dark vignette/gradient bottom-up for label legibility; optional subtle
  grain for "captured operational footage" feel. Uses existing design tokens.

## Timeline banner

A distinct band within the hero (top strip or header row):
- Static, server-rendered: **"Going live June 29"** (derived from `FLEET_GO_LIVE`).
- Client-computed countdown after mount: **"Live in {N} days"** (or "Live today" / "Live
  now" at/after the date). Computed in `useEffect` to avoid SSR/CSR hydration mismatch
  (server renders the date only; the countdown hydrates in).

## Placeholder / never-broken state

Rendered when `FLEET_CLIPS` is empty **or** a clip's `<video>` fires an `error` (404 /
decode fail):
- Dark gradient stage, centered Kovio mark, soft scanlines, and a cycling set of location
  names so it still feels "operational."
- Caption: **"Fleet feed coming online · June 29"**.
- If a single clip in a non-empty set fails, skip it and continue the rotation; if all
  fail, fall back to this placeholder.

## Responsive / accessibility

- 16:9 stage, full-width on desktop (primary). Mobile (secondary): maintains aspect,
  smaller banner/label type; lives inside the existing responsive content column.
- `prefers-reduced-motion: reduce`: do **not** autoplay/auto-advance; show the first
  clip's poster (or the placeholder) statically. The global reduced-motion rule already
  neutralizes `.k-pulse` and transitions.
- `<video>` elements get descriptive `aria-label`s ("Kovio robot running ads at
  {location}"). The banner is real text, not an image. The hero is `aria-roledescription`
  "Fleet activity feed" with `aria-label`; indicator dots are `aria-hidden` (decorative).

## Testing

- `lib/__tests__/fleet-clips.test.ts`: `daysUntil` (future, today, past → 0; floor
  behavior), and that the default committed manifest is empty (so prod ships placeholder
  until assets are added intentionally).
- Component-level: a small test that `LiveActivityHero` renders the placeholder when
  given an empty manifest (render + assert the "coming online" caption), if the existing
  test setup supports rendering this client component; otherwise covered by the pure
  helper tests + manual verification via the temporary preview route pattern.

## Integration points

- `app/dashboard/page.tsx`: import and render `<LiveActivityHero />` as the first child
  of the trial (`campaigns.length === 0`) branch, before the date label / greeting.
- No changes to `AppShell`, `Sidebar`, proxy, or the active overview.

## Verification

Build a temporary public preview route (the established `/sandbox-preview` pattern) to
screenshot the hero at desktop + mobile widths, including the empty-manifest placeholder
state, then remove it. `npx tsc --noEmit` + `npm test` must pass.

## Non-goals / future

- Real fleet telemetry, per-clip metadata from the API, click-through, or A/B of copy.
- Sourcing/encoding the actual MP4s (user-provided).
