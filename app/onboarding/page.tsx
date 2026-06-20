'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

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
    body: 'On-device vision + LiDAR count who actually looked — measured, never estimated.',
  },
  {
    title: 'Private by design',
    body: 'Faces never leave the robot. Only anonymous counts ever travel to Kovio.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
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
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[1040px]">
        <div className="font-mono text-[13px] uppercase tracking-[0.18em] text-faint">Kovio</div>

        <h1 className="mt-8 max-w-[900px] font-serif text-[68px] font-medium leading-[1.02] tracking-[-0.02em] text-ink">
          Advertising that <em className="italic text-accent">walks the city.</em>
        </h1>
        <p className="mt-6 max-w-[680px] text-[22px] leading-[1.5] text-muted">
          Kovio puts your brand on autonomous robots rolling through real streets — and shows you
          exactly who looked, measured frame-by-frame on the robot itself.
        </p>

        {/* Value props */}
        <div className="mt-12 grid grid-cols-3 gap-5">
          {VALUE_PROPS.map((v, i) => (
            <div key={v.title} className="rounded-[16px] border border-line bg-panel px-7 py-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-tint font-mono text-[14px] text-accent-dark">
                {i + 1}
              </div>
              <div className="mt-4 text-[18px] font-semibold text-ink">{v.title}</div>
              <div className="mt-1.5 text-[15px] leading-[1.5] text-muted">{v.body}</div>
            </div>
          ))}
        </div>

        {/* Brand capture */}
        <div className="mt-12 max-w-[560px]">
          <h2 className="font-serif text-[30px] font-medium tracking-[-0.01em] text-ink">
            Let&apos;s get your brand on the road.
          </h2>
          <form onSubmit={handleSubmit} className="mt-6">
            <label htmlFor="brand" className="mb-2 block text-[17px] text-ink">
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
              className="w-full rounded-[12px] border border-accent bg-field px-[22px] py-5 text-lg text-ink outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || !brand.trim()}
              className="mt-4 w-full rounded-[12px] bg-accent py-5 text-lg text-white transition-colors duration-200 hover:bg-accent-dark disabled:opacity-50"
            >
              {loading ? 'Setting up…' : 'Continue →'}
            </button>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </form>
          <p className="mt-4 text-[15px] text-muted">
            Your first campaign is on us — no card needed to launch.
          </p>
        </div>
      </div>
    </div>
  );
}
