'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import { KovioMark } from '@/components/KovioMark';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

const VALUE_PROPS: Array<{ title: string; body: string }> = [
  {
    title: 'Real-world reach',
    body: 'Your creative on robot screens moving through the busiest blocks of the city.',
  },
  {
    title: 'Verified attention',
    body: 'On-device vision + LiDAR count who actually looked. Measured, never estimated.',
  },
  {
    title: 'Private by design',
    body: 'Faces never leave the robot. Only anonymous counts ever travel to Kovio.',
  },
];

const INCLUDED: Array<React.ReactNode> = [
  <>Campaigns on <span className="font-semibold text-ink">robot fleets</span> — real robots on real streets.</>,
  <><span className="font-semibold text-ink">Verified attention</span>, measured frame-by-frame on the robot.</>,
  <>Full reporting with <span className="font-semibold text-ink">AI analysis</span> under Insights.</>,
  <><span className="font-semibold text-ink">Upfront pricing</span> — the fleet’s day rate × your dates, paid once via Stripe.</>,
];

export default function OnboardingPage() {
  const router = useRouter();
  // Staff accounts must never onboard as advertiser/operator — completing this
  // form would convert the admin account into an org member (which is exactly
  // how an admin once got stranded in a test org). Bounce them to /admin.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc('kovio_is_admin');
      if (data) router.replace('/admin');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [brand, setBrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = brand.trim();
    if (!name) return;
    setLoading(true);
    setError('');

    const base = slugify(name) || 'brand';
    for (const slug of [base, `${base}-${randomSuffix()}`]) {
      const { error } = await apiClient.onboard({ org_name: name, org_slug: slug });
      if (!error || error.code === 'already_onboarded') {
        router.push('/dashboard');
        router.refresh();
        return;
      }
      if (error.code !== 'slug_taken') {
        setLoading(false);
        setError(error.detail ?? 'Something went wrong. Please try again.');
        return;
      }
    }
    setLoading(false);
    setError('Could not create your workspace. Please try again.');
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* top bar */}
      <div className="mx-auto flex max-w-[1080px] items-center justify-between px-9 py-[22px]">
        <div className="flex items-center gap-[11px]">
          <KovioMark className="h-[22px] w-[22px] text-accent" />
          <span className="font-mono text-[16px] tracking-[0.18em]">KOVIO</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
            Step 1 of 2 · Set up
          </div>
          <form action="/auth/logout" method="post">
            <button className="rounded-[9px] border border-line-strong px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-9 pb-20 pt-9">
        {/* network badge — fixed-dark surface */}
        <div className="inline-flex items-center gap-[9px] rounded-full bg-[#332c24] px-4 py-2 text-[#f1ead9]">
          <span className="k-pulse h-[7px] w-[7px] rounded-full bg-[#5cbe85]" />
          <span className="font-mono text-[12px] uppercase tracking-[0.1em]">
            Network online · robot fleets
          </span>
        </div>

        <h1 className="mt-[22px] max-w-[900px] font-serif text-[clamp(44px,6vw,72px)] font-medium leading-[1.02] tracking-[-0.02em]">
          Advertising that <em className="italic text-accent-dark">walks the city.</em>
        </h1>
        <p className="mt-[22px] max-w-[680px] text-[21px] leading-[1.5] text-muted">
          Kovio puts your brand on autonomous robots rolling through real streets, and shows you
          exactly who looked, measured frame-by-frame on the robot itself.
        </p>

        {/* value props */}
        <div className="mt-12 grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          {VALUE_PROPS.map((v, i) => (
            <div key={v.title} className="rounded-[16px] border border-line bg-panel p-[26px]">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint font-mono text-[14px] text-accent-dark">
                {i + 1}
              </div>
              <div className="mt-4 text-[18px] font-semibold">{v.title}</div>
              <div className="mt-1.5 text-[15px] leading-[1.5] text-muted">{v.body}</div>
            </div>
          ))}
        </div>

        {/* brand capture + trial */}
        <div className="mt-12 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="font-serif text-[32px] font-medium tracking-[-0.01em]">
              Let&apos;s get your brand on the road.
            </h2>
            <form onSubmit={handleSubmit} className="mt-[22px]">
              <label htmlFor="brand" className="mb-2 block text-[16px]">
                Brand name
              </label>
              <input
                id="brand"
                type="text"
                required
                autoFocus
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Your brand"
                className="w-full rounded-[12px] border border-accent bg-field px-5 py-[17px] text-[17px] text-ink outline-none transition-colors focus:border-accent-dark"
              />
              <button
                type="submit"
                disabled={loading || !brand.trim()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-accent py-[17px] text-[17px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
              >
                {loading ? 'Setting up…' : 'Create my workspace →'}
              </button>
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            </form>
            <p className="mt-4 text-[15px] text-muted">
              Setting up is free. <span className="font-semibold text-ink">You only pay when you launch a campaign.</span>
            </p>
          </div>

          {/* trial summary card */}
          <div className="rounded-[18px] border border-tint-line bg-tint p-[26px]">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-dark">
              What you get
            </div>
            <div className="mt-4 flex flex-col gap-[14px]">
              {INCLUDED.map((node, i) => (
                <div key={i} className="flex items-start gap-[11px]">
                  <span className="mt-0.5 flex-none text-good">✓</span>
                  <span className="text-[15px] leading-[1.45]">{node}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-tint-line pt-[18px] text-[13px] text-muted">
              Simple <span className="font-semibold text-ink">pay-per-campaign</span> pricing — the set
              price is shown before you submit, charged once via Stripe.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
