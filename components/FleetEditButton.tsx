'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function FleetEditButton({
  fleetId,
  initialName,
}: {
  fleetId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    const { error } = await apiClient.oemUpdateFleet(fleetId, { name });
    setLoading(false);
    if (!error) {
      setEditing(false);
      router.refresh();
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center rounded-md border border-border-soft px-4 py-2.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        Edit fleet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-border-mid bg-card px-3 py-2 text-sm text-ink focus:border-rust focus:outline-none"
      />
      <button
        onClick={save}
        disabled={loading || !name}
        className="rounded-md bg-rust px-3 py-2 text-sm text-page hover:bg-rust-dark disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>
      <button onClick={() => setEditing(false)} className="text-sm text-ink-2 hover:text-ink">
        Cancel
      </button>
    </div>
  );
}
