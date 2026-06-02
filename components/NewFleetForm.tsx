'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const inputCls =
  'w-full rounded-md border border-border-mid bg-card px-4 py-2.5 text-sm text-ink transition-colors focus:border-rust focus:outline-none';

export default function NewFleetForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error } = await apiClient.oemCreateFleet({
      name,
      region: region || undefined,
    });
    if (error || !data) {
      setLoading(false);
      setError(error?.detail ?? 'Something went wrong.');
      return;
    }
    router.push(`/oem/fleets/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg border border-border-soft bg-card p-6">
      <div className="font-mono text-label uppercase text-ink-3">Identity</div>
      <div className="mt-3 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-ink-2">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pilot fleet · SF Bay"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-ink-2">Region (optional)</label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="San Francisco"
            className={inputCls}
          />
        </div>
      </div>

      <div className="my-6 border-t border-dashed border-border-soft" />
      <div className="flex items-center justify-between">
        <Link href="/oem/fleets" className="text-sm text-ink-2 transition-colors hover:text-ink">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading || !name}
          className="rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create fleet'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}
