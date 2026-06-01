'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function OnboardingPage() {
  const router = useRouter();
  // NOTE: only the "brand" (advertiser) path has a backend endpoint. "Fleet
  // operator" is shown for parity but disabled until the OEM onboarding
  // endpoint exists (no new frontend endpoints per spec).
  const [kind, setKind] = useState<'brand' | 'oem'>('brand');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function onNameChange(value: string) {
    setOrgName(value);
    if (!slugEdited) setOrgSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await apiClient.onboard({ org_name: orgName, org_slug: orgSlug });
    if (error) {
      setLoading(false);
      if (error.code === 'slug_taken') setError('That slug is already taken — try another.');
      else if (error.code === 'already_onboarded') {
        router.push('/dashboard');
        router.refresh();
      } else setError(error.detail ?? 'Something went wrong. Please try again.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  const choice = (
    value: 'brand' | 'oem',
    title: string,
    subtitle: string,
    disabled = false,
  ) => {
    const selected = kind === value;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setKind(value)}
        className={`w-full rounded-lg border p-4 text-left transition-colors duration-200 ${
          disabled
            ? 'cursor-not-allowed border-border-soft bg-card opacity-60'
            : selected
              ? 'border-rust bg-rust-soft text-rust-dark'
              : 'border-border-soft bg-card text-ink-2 hover:bg-card-hover'
        }`}
      >
        <div className="text-sm font-medium text-ink">
          {title}
          {disabled && <span className="ml-2 text-xs text-ink-3">· coming soon</span>}
        </div>
        <div className="mt-1 text-xs text-ink-3">{subtitle}</div>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[500px]">
        <div className="font-mono text-xs uppercase tracking-wider text-ink-3">Kovio</div>
        <h1 className="mt-6 font-serif text-h1 text-ink">Welcome to Kovio.</h1>
        <p className="mt-2 text-ink-2">Tell us who you are.</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {choice('brand', 'Brand', 'Run campaigns on robot fleets')}
          {choice('oem', 'Fleet operator', "Earn revenue from your robots' screens", true)}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-ink-2">Organization name</label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Alice Coffee"
              className="w-full rounded-md border border-border-mid bg-card px-4 py-2.5 text-sm text-ink transition-colors focus:border-rust focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-ink-2">Slug</label>
            <div className="flex items-center gap-1 rounded-md border border-border-mid bg-card px-4 py-2.5 focus-within:border-rust">
              <span className="font-mono text-sm text-ink-3">kovio.dev/</span>
              <input
                type="text"
                required
                pattern="[a-z0-9\-]+"
                value={orgSlug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setOrgSlug(e.target.value);
                }}
                placeholder="alice-coffee"
                className="flex-1 bg-transparent font-mono text-sm text-ink focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !orgName || !orgSlug}
            className="w-full rounded-md bg-rust py-3 text-sm text-page transition-colors duration-200 hover:bg-rust-dark disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create organization'}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </div>
    </div>
  );
}
