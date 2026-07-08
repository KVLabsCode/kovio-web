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
    title: 'A new revenue stream',
    body: 'Turn the screens already on your robots into paid ad inventory — Kovio fills them and splits the revenue with you.',
  },
  {
    title: 'Plug-and-play SDK',
    body: 'Mint a fleet API key, drop in the SDK, and your robots start pulling campaigns and reporting plays in minutes.',
  },
  {
    title: 'You set the terms',
    body: 'Your revenue share, your fleets, your allow/block lists. Faces never leave the robot — only anonymous counts travel to Kovio.',
  },
];

export default function OemOnboardingPage() {
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

  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = company.trim();
    if (!name) return;
    setLoading(true);
    setError('');

    const base = slugify(name) || 'fleet';
    for (const slug of [base, `${base}-${randomSuffix()}`]) {
      const { error } = await apiClient.oemOnboard({ org_name: name, org_slug: slug });
      if (!error || error.code === 'already_onboarded') {
        router.push('/oem/dashboard');
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
    setError('Could not create your fleet workspace. Please try again.');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-16">
      <div className="w-full max-w-[1040px]">
        <div className="flex items-center gap-[11px]">
          <KovioMark className="h-6 w-6 text-accent" />
          <span className="font-mono text-[15px] tracking-[0.18em] text-ink">KOVIO</span>
          <span className="font-mono text-[13px] uppercase tracking-[0.18em] text-faint">/ for fleets</span>
        </div>

        <h1 className="mt-8 max-w-[900px] font-serif text-[clamp(40px,6vw,68px)] font-medium leading-[1.03] tracking-[-0.02em] text-ink">
          Put your robots <em className="italic text-accent">to work.</em>
        </h1>
        <p className="mt-6 max-w-[680px] text-[clamp(17px,2.4vw,22px)] leading-[1.5] text-muted">
          Register your fleet to turn the screens already rolling through the city into paid ad
          inventory — and earn a revenue share on every verified impression.
        </p>

        {/* Value props */}
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
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

        {/* Company capture */}
        <div className="mt-12 max-w-[560px]">
          <h2 className="font-serif text-[30px] font-medium tracking-[-0.01em] text-ink">
            Let&apos;s get your fleet earning.
          </h2>
          <form onSubmit={handleSubmit} className="mt-6">
            <label htmlFor="company" className="mb-2 block text-[17px] text-ink">
              Company name
            </label>
            <input
              id="company"
              type="text"
              required
              autoFocus
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Your robotics company"
              className="w-full rounded-[12px] border border-accent bg-field px-[22px] py-5 text-lg text-ink outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || !company.trim()}
              className="mt-4 w-full rounded-[12px] bg-accent py-5 text-lg text-white transition-colors duration-200 hover:bg-accent-dark disabled:opacity-50"
            >
              {loading ? 'Setting up…' : 'Register fleet →'}
            </button>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
