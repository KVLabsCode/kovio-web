'use client';

import { useCallback, useEffect, useState } from 'react';

type Step = { eyebrow: string; title: string; body: string; cta?: { label: string; href: string } };

// Bump the version to re-show the tour to everyone after a meaningful change.
const VERSION = 'v2';

const STEPS: Record<'advertiser' | 'oem', Step[]> = {
  advertiser: [
    {
      eyebrow: 'Welcome to Kovio',
      title: 'Advertising that walks the city.',
      body: 'Put your brand on autonomous robots rolling through real streets — and see exactly who looked. Here’s a 30-second tour.',
    },
    {
      eyebrow: 'Your dashboard',
      title: 'Everything at a glance.',
      body: 'Impressions, verified attention, spend and attributed GMV — with a live activity feed of real interactions. Use the range pills to switch 24H / 7D / 30D.',
    },
    {
      eyebrow: 'Step 1',
      title: 'Launch a campaign on robot fleets.',
      body: 'Name it, drop a creative, pick your dates — the price is set upfront by the fleet’s day rate, paid once via Stripe. It runs on real robots once the fleet approves.',
      cta: { label: 'Create a campaign →', href: '/campaigns/place' },
    },
    {
      eyebrow: 'Step 2',
      title: 'Track it under Campaigns.',
      body: 'Follow each campaign’s status, confirm any date changes the operator proposes, and message them directly on the campaign.',
      cta: { label: 'View your campaigns →', href: '/campaigns' },
    },
    {
      eyebrow: 'Step 3',
      title: 'See who actually looked.',
      body: 'Hawkeye shows live footage with on-device attention counts; Insights breaks down performance. Billing is simple pay-per-campaign — you only pay for what runs.',
      cta: { label: 'Open Insights →', href: '/insights' },
    },
  ],
  oem: [
    {
      eyebrow: 'Welcome to Kovio for fleets',
      title: 'Put your robots to work.',
      body: 'Turn the screens already rolling through the city into paid ad inventory, and earn a revenue share on every verified impression. Here’s a quick tour.',
    },
    {
      eyebrow: 'Your dashboard',
      title: 'Track what your fleet earns.',
      body: 'Revenue, impressions, verified attention and your pending payout — broken down by fleet, with a live feed of real interactions.',
    },
    {
      eyebrow: 'Step 1',
      title: 'Register a fleet.',
      body: 'Add a fleet, mint an API key, and drop the SDK into your robots. They start pulling campaigns and reporting plays in minutes.',
      cta: { label: 'Add a fleet →', href: '/oem/fleets/new' },
    },
    {
      eyebrow: 'Step 2',
      title: 'Run your own custom campaigns.',
      body: 'Upload an advertiser’s creative, add a scannable QR, and point any robot screen at the link — a full-screen looping display you control.',
      cta: { label: 'Create a custom campaign →', href: '/oem/campaigns/new' },
    },
    {
      eyebrow: 'Step 3',
      title: 'Approve incoming campaigns.',
      body: 'Advertisers can place custom campaigns with your fleet. They land in your Campaigns tab with full details — you accept or reject, and we email you when one arrives.',
      cta: { label: 'Go to Campaigns →', href: '/oem/campaigns' },
    },
  ],
};

export default function OnboardingTour({ role }: { role: 'advertiser' | 'oem' }) {
  const steps = STEPS[role];
  const storageKey = `kovio_tour_${VERSION}_${role}`;

  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  // Auto-open once per browser (client-only to avoid hydration mismatch).
  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch {}
  }, [storageKey]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {}
  }, [storageKey]);

  const start = () => {
    setI(0);
    setOpen(true);
  };

  const next = useCallback(() => {
    setI((n) => {
      if (n >= steps.length - 1) {
        close();
        return n;
      }
      return n + 1;
    });
  }, [steps.length, close]);

  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // Keyboard nav while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, next, prev]);

  // Re-open button (always available once the tour has been dismissed).
  const tourButton = (
    <button
      type="button"
      onClick={start}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel px-4 py-2.5 text-[13px] font-medium text-ink shadow-[0_6px_24px_rgba(0,0,0,0.12)] transition-colors hover:border-accent"
      aria-label="Open the getting-started tour"
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">?</span>
      Tour
    </button>
  );

  if (!open) return tourButton;

  const step = steps[i];
  const isLast = i === steps.length - 1;

  return (
    <>
      {tourButton}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
        onClick={close}
        role="dialog"
        aria-modal="true"
        aria-label="Getting started"
      >
        <div
          className="w-full max-w-[460px] rounded-[18px] border border-line bg-panel p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">{step.eyebrow}</div>
            <button
              type="button"
              onClick={close}
              className="text-[13px] text-muted transition-colors hover:text-ink"
              aria-label="Skip the tour"
            >
              Skip
            </button>
          </div>

          <h2 className="mt-4 font-serif text-[27px] font-medium leading-[1.1] tracking-[-0.01em] text-ink">
            {step.title}
          </h2>
          <p className="mt-3 text-[15px] leading-[1.6] text-muted">{step.body}</p>

          {step.cta && (
            <a
              href={step.cta.href}
              className="mt-4 inline-flex text-[14px] font-medium text-accent-dark transition-colors hover:text-accent"
            >
              {step.cta.label}
            </a>
          )}

          <div className="mt-7 flex items-center justify-between">
            {/* progress dots */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {steps.map((_, n) => (
                <span
                  key={n}
                  className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-accent' : 'w-1.5 bg-line-strong'}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {i > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-[10px] border border-line-strong px-4 py-2 text-[14px] text-ink transition-colors hover:border-accent"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="rounded-[10px] bg-accent px-5 py-2 text-[14px] text-white transition-colors hover:bg-accent-dark"
              >
                {isLast ? 'Get started' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
