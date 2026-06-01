'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function OnboardingPage() {
  const router = useRouter();
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
      if (error.code === 'slug_taken') {
        setError('That slug is already taken — try a different one.');
      } else if (error.code === 'already_onboarded') {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(error.detail ?? 'Something went wrong. Please try again.');
      }
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold">Welcome to Kovio</h1>
      <p className="mb-6 text-sm text-gray-600">
        Create your advertiser organization to get started.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Organization name</label>
          <input
            type="text"
            required
            value={orgName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Alice Coffee"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Slug</label>
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
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Lowercase letters, numbers, and dashes. Used in URLs.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading || !orgName || !orgSlug}
          className="w-full rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create organization'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
