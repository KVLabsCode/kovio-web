# Live Activity Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a purely-visual "Live Activity" video hero to the top of the advertiser trial dashboard that showcases the robot fleet and a "Going live June 29" countdown, motivating new advertisers to get their creative in the queue.

**Architecture:** A manifest-driven client component (`LiveActivityHero`) renders a 16:9 cinematic stage that auto-advances through clips listed in `lib/fleet-clips.ts` (files served from `public/videos/`). All time/rotation/label decisions live in pure, unit-tested helpers in the manifest module; the component is thin glue plus markup. An empty manifest (the default committed state) renders a styled placeholder so the feature ships before any footage exists.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (CSS `@theme` tokens), Vitest (node environment).

## Global Constraints

- **Test environment is `node`** (no jsdom / no `@testing-library/react`). Only pure functions get unit tests; component rendering is verified via a temporary public preview route + screenshots.
- **Tailwind v4, no config file.** Use existing tokens only (`bg-panel`, `border-line`, `text-ink`, `text-muted`, `text-faint`, `bg-accent`, `text-accent`, `bg-good`, etc.). No `tailwind.config`.
- **No em-dashes in user-facing copy.** Use commas, periods, or middots (`·`). (Repo convention; see commit d2d9b48.)
- **Autoplay requires `muted` + `playsInline`.** Never add video controls or click handlers — the hero is purely visual.
- **Respect `prefers-reduced-motion`.** No autoplay / auto-advance when set; show a static frame.
- **Client component for interactivity.** `LiveActivityHero` is `'use client'`; the dashboard page stays a server component and just renders it.
- **Trial view only.** Integrate into the `campaigns.length === 0` branch of `app/dashboard/page.tsx`. Do not touch the active overview, AppShell, Sidebar, or proxy.

---

### Task 1: Manifest + pure helpers (`lib/fleet-clips.ts`)

**Files:**
- Create: `lib/fleet-clips.ts`
- Test: `lib/__tests__/fleet-clips.test.ts`

**Interfaces:**
- Produces:
  - `type FleetClip = { src: string; location: string; poster?: string }`
  - `const FLEET_GO_LIVE: string` (= `'2026-06-29'`)
  - `const FLEET_CLIPS: FleetClip[]` (empty by default)
  - `function daysUntil(dateISO: string, now: Date): number` — whole calendar days from `now` to `dateISO` (negative if past)
  - `function goLiveLabel(days: number): string` — countdown copy
  - `function goLiveDateLabel(dateISO: string): string` — e.g. `'June 29'`
  - `function nextIndex(current: number, length: number): number` — wraps; returns `0` when `length === 0`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/fleet-clips.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  FLEET_CLIPS,
  FLEET_GO_LIVE,
  daysUntil,
  goLiveLabel,
  goLiveDateLabel,
  nextIndex,
} from '@/lib/fleet-clips';

describe('fleet-clips manifest', () => {
  it('ships empty so prod renders the placeholder until assets are added', () => {
    expect(FLEET_CLIPS).toEqual([]);
  });
  it('targets the launch date', () => {
    expect(FLEET_GO_LIVE).toBe('2026-06-29');
  });
});

describe('daysUntil', () => {
  it('counts whole days to a future date regardless of time of day', () => {
    expect(daysUntil('2026-06-29', new Date('2026-06-24T20:00:00'))).toBe(5);
    expect(daysUntil('2026-06-29', new Date('2026-06-24T01:00:00'))).toBe(5);
  });
  it('is 0 on the day itself', () => {
    expect(daysUntil('2026-06-29', new Date('2026-06-29T09:00:00'))).toBe(0);
  });
  it('is negative once the date has passed', () => {
    expect(daysUntil('2026-06-29', new Date('2026-07-01T09:00:00'))).toBe(-2);
  });
});

describe('goLiveLabel', () => {
  it('pluralizes the countdown', () => {
    expect(goLiveLabel(5)).toBe('Live in 5 days');
    expect(goLiveLabel(1)).toBe('Live in 1 day');
  });
  it('handles launch day and after', () => {
    expect(goLiveLabel(0)).toBe('Going live today');
    expect(goLiveLabel(-3)).toBe('Live now');
  });
});

describe('goLiveDateLabel', () => {
  it('formats as month and day', () => {
    expect(goLiveDateLabel('2026-06-29')).toBe('June 29');
  });
});

describe('nextIndex', () => {
  it('wraps around the set', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
  it('returns 0 for an empty set', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/fleet-clips.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/fleet-clips"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/fleet-clips.ts`:

```ts
// Manifest for the dashboard Live Activity hero. Drop MP4s into public/videos/
// and add an entry per clip. An empty FLEET_CLIPS renders the placeholder hero,
// so the feature ships safely before any footage exists.

export type FleetClip = {
  src: string; // e.g. '/videos/market-street.mp4'
  location: string; // shown over the clip, e.g. 'Market Street · San Francisco'
  poster?: string; // optional still shown before the video paints / under reduced motion
};

// Advertiser-facing fleet activation date. Hardcoded for the launch push.
export const FLEET_GO_LIVE = '2026-06-29';

export const FLEET_CLIPS: FleetClip[] = [
  // { src: '/videos/market-street.mp4', location: 'Market Street · San Francisco', poster: '/videos/market-street.jpg' },
];

// Whole calendar days from `now` to `dateISO` (negative once past). Both sides are
// floored to local midnight so the result is stable across the day; Math.round
// absorbs the <=1h DST drift between two midnights.
export function daysUntil(dateISO: string, now: Date): number {
  const target = new Date(`${dateISO}T00:00:00`);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function goLiveLabel(days: number): string {
  if (days > 1) return `Live in ${days} days`;
  if (days === 1) return 'Live in 1 day';
  if (days === 0) return 'Going live today';
  return 'Live now';
}

export function goLiveDateLabel(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
}

export function nextIndex(current: number, length: number): number {
  return length > 0 ? (current + 1) % length : 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/fleet-clips.test.ts`
Expected: PASS (13 assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/fleet-clips.ts lib/__tests__/fleet-clips.test.ts
git commit -m "feat(dashboard): fleet-clips manifest + countdown helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `LiveActivityHero` component

**Files:**
- Create: `components/LiveActivityHero.tsx`

**Interfaces:**
- Consumes: `FLEET_CLIPS`, `FLEET_GO_LIVE`, `daysUntil`, `goLiveLabel`, `goLiveDateLabel`, `nextIndex` from `@/lib/fleet-clips`; `KovioMark` (named export) from `@/components/KovioMark`.
- Produces: `export default function LiveActivityHero()` — no props. Rendered by the dashboard trial branch in Task 3.

> No unit test: the test env is `node` and cannot render React. This component is verified in Task 3 via the preview route + screenshots. Correctness of its time/rotation logic is already covered by Task 1's helper tests.

- [ ] **Step 1: Write the component**

Create `components/LiveActivityHero.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { KovioMark } from './KovioMark';
import {
  FLEET_CLIPS,
  FLEET_GO_LIVE,
  daysUntil,
  goLiveLabel,
  goLiveDateLabel,
  nextIndex,
} from '@/lib/fleet-clips';

// Cycled under the placeholder (no real clips) so it still feels operational.
const PLACEHOLDER_LOCATIONS = [
  'Market Street · San Francisco',
  'Financial District Lobby',
  'Transit Hub · Embarcadero',
  'Union Square · Downtown',
];

// Bright green for the dark stage (the bg-good token is tuned for light surfaces).
const LIVE_GREEN = '#5cbe85';

export default function LiveActivityHero() {
  const clips = FLEET_CLIPS;
  const hasClips = clips.length > 0;
  const dateLabel = goLiveDateLabel(FLEET_GO_LIVE); // SSR-safe (no `now`)

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [countdown, setCountdown] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [phLoc, setPhLoc] = useState(0);

  // Countdown + reduced-motion are client-only (avoid hydration mismatch).
  useEffect(() => {
    setCountdown(goLiveLabel(daysUntil(FLEET_GO_LIVE, new Date())));
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Rotate placeholder labels (only when animating + showing the placeholder).
  useEffect(() => {
    if (hasClips || reduced) return;
    const id = window.setInterval(
      () => setPhLoc((i) => (i + 1) % PLACEHOLDER_LOCATIONS.length),
      2600,
    );
    return () => window.clearInterval(id);
  }, [hasClips, reduced]);

  const allFailed = hasClips && failed.size >= clips.length;
  const showPlaceholder = !hasClips || allFailed;

  function advance() {
    if (reduced) return;
    setIndex((i) => {
      let n = nextIndex(i, clips.length);
      let guard = 0;
      while (failed.has(n) && guard < clips.length) {
        n = nextIndex(n, clips.length);
        guard += 1;
      }
      return n;
    });
  }

  return (
    <section
      aria-roledescription="Fleet activity feed"
      aria-label="Live Kovio robot fleet activity"
      className="relative overflow-hidden rounded-[20px] border border-line bg-[#15110c] text-white shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
    >
      <div className="relative aspect-video w-full">
        {showPlaceholder ? (
          <Placeholder location={PLACEHOLDER_LOCATIONS[phLoc]} dateLabel={dateLabel} />
        ) : (
          <video
            key={clips[index].src}
            src={clips[index].src}
            poster={clips[index].poster}
            autoPlay={!reduced}
            muted
            loop={clips.length === 1 && !reduced}
            playsInline
            preload="metadata"
            aria-label={`Kovio robot running ads at ${clips[index].location}`}
            onEnded={advance}
            onError={() => {
              setFailed((s) => new Set(s).add(index));
              advance();
            }}
            className="h-full w-full object-cover"
          />
        )}

        {/* cinematic gradient for label legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

        {/* top row: LIVE badge + countdown banner */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] backdrop-blur-sm">
            <span className="k-pulse h-1.5 w-1.5 rounded-full" style={{ background: LIVE_GREEN }} />
            Live · Kovio fleet
          </span>
          <span className="inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white shadow">
            {countdown ?? `Going live ${dateLabel}`}
          </span>
        </div>

        {/* bottom row: location + position dots (decorative) */}
        {!showPlaceholder && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 sm:p-5">
            <span className="font-serif text-[18px] drop-shadow sm:text-[22px]">
              {clips[index].location}
            </span>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {clips.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/45'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* caption strip */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
        <span className="text-[13px] text-white/70">
          Real robots, real locations. Your campaign joins the fleet when it goes live.
        </span>
        <span className="hidden font-mono text-[12px] text-white/55 sm:block">
          Going live {dateLabel}
        </span>
      </div>
    </section>
  );
}

function Placeholder({ location, dateLabel }: { location: string; dateLabel: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#241a10,#120d08)]">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_3px)]" />
      <KovioMark className="h-10 w-10 text-accent" />
      <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
        Fleet feed coming online
      </div>
      <div className="mt-2 font-serif text-[22px] text-white/90">{location}</div>
      <div className="mt-3 rounded-full bg-accent/90 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em]">
        Going live {dateLabel}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add components/LiveActivityHero.tsx
git commit -m "feat(dashboard): LiveActivityHero component (player + placeholder)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Integrate into the trial dashboard + verify

**Files:**
- Modify: `app/dashboard/page.tsx` (the `campaigns.length === 0` branch)
- Temporary (created then removed): `app/sandbox-preview/page.tsx`, one line in `proxy.ts`

**Interfaces:**
- Consumes: `LiveActivityHero` default export from `@/components/LiveActivityHero`.

- [ ] **Step 1: Import the component**

In `app/dashboard/page.tsx`, add to the imports near the other component imports (`AppShell`, `RangePills`, `HawkeyeTile`):

```tsx
import LiveActivityHero from '@/components/LiveActivityHero';
```

- [ ] **Step 2: Render the hero atop the trial branch**

In the `if (campaigns.length === 0) {` branch, the returned JSX currently starts:

```tsx
      <AppShell page="Overview" action={newCampaignBtn}>
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">
          {dateLabel(now)}
        </div>
```

Insert the hero as the first child of `<AppShell>`, before that date `<div>`:

```tsx
      <AppShell page="Overview" action={newCampaignBtn}>
        <LiveActivityHero />
        <div className="mt-7 font-mono text-[12px] uppercase tracking-[0.16em] text-faint">
          {dateLabel(now)}
        </div>
```

(Note the added `mt-7` on the date row so the greeting sits a comfortable distance below the hero.)

- [ ] **Step 3: Typecheck + run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass (existing 37 + 13 new = 50).

- [ ] **Step 4: Add a temporary preview route to screenshot the hero**

Create `app/sandbox-preview/page.tsx`:

```tsx
'use client';
// TEMPORARY preview — delete before final commit; also revert proxy.ts.
import LiveActivityHero from '@/components/LiveActivityHero';

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-bg p-6 sm:p-10">
      <div className="mx-auto w-full max-w-[1180px]">
        <LiveActivityHero />
      </div>
    </div>
  );
}
```

In `proxy.ts`, add `'/sandbox-preview'` to the `PUBLIC_PATHS` array (temporarily):

```ts
const PUBLIC_PATHS = ['/login', '/oem/login', '/auth/callback', '/auth/confirm', '/r/', '/creative/', '/sandbox-preview'];
```

- [ ] **Step 5: Run the dev server and screenshot the placeholder hero**

Ensure a dev server is running on :3000 (`npx next dev -p 3000` if needed). Wait for `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sandbox-preview` to return `200`, then capture screenshots at 1280px and 390px widths (Playwright MCP or chromium-cli). Confirm visually:
  - 16:9 dark stage with the "Fleet feed coming online · {location}" placeholder (manifest is empty).
  - Top-left pulsing "Live · Kovio fleet" badge; top-right accent countdown pill ("Live in N days").
  - Bottom caption strip readable; rounded corners; no clipping.
  - Mobile (390px): maintains 16:9, banner/label legible.

Expected: a clean cinematic placeholder hero at both widths.

- [ ] **Step 6: Remove the temporary preview + revert proxy**

```bash
rm -rf app/sandbox-preview
```
Revert the `proxy.ts` line back to:
```ts
const PUBLIC_PATHS = ['/login', '/oem/login', '/auth/callback', '/auth/confirm', '/r/', '/creative/'];
```
Verify no leftovers: `grep -rn "sandbox-preview" app proxy.ts` returns nothing.

- [ ] **Step 7: Final typecheck + tests, then commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

```bash
git add app/dashboard/page.tsx proxy.ts
git commit -m "feat(dashboard): show Live Activity hero on the trial view

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## After implementation: adding real footage

To light up real clips (no code change beyond the manifest):
1. Drop encoded MP4s (H.264, muted, 10–30s, ~720p–1080p) into `public/videos/`.
2. Add one `FLEET_CLIPS` entry per clip in `lib/fleet-clips.ts` with its `src`, a `location` label (no advertiser branding), and optional `poster` still.
The hero swaps from the placeholder to the rotating player automatically.

## Plan self-review

- **Spec coverage:** hero on trial view (Task 3) ✓; manifest-driven clips (Task 1/2) ✓; single cinematic auto-advancing player with crossfade-via-`key`/opacity gradient (Task 2) ✓; LIVE badge + location label + decorative dots, no branding (Task 2) ✓; "Going live June 29" + countdown banner (Task 1 helpers + Task 2) ✓; placeholder/never-broken + missing-file skip (Task 2) ✓; reduced-motion + autoplay rules (Task 2 + Global Constraints) ✓; responsive 16:9 (Task 2) ✓; a11y labels/roledescription (Task 2) ✓; tests for pure helpers + empty-manifest default (Task 1) ✓; preview-route verification (Task 3) ✓.
- **Placeholder scan:** all steps contain concrete code/commands; no TBD/TODO.
- **Type consistency:** helper names/signatures (`daysUntil`, `goLiveLabel`, `goLiveDateLabel`, `nextIndex`, `FleetClip`, `FLEET_CLIPS`, `FLEET_GO_LIVE`) match between Task 1 (produces) and Task 2 (consumes).
