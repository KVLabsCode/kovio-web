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
