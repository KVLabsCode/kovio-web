'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const CATEGORIES = ['food', 'retail', 'brand', 'transport', 'other'];

export default function FleetBrandSafety({
  fleetId,
  initialCategories,
}: {
  fleetId: string;
  initialCategories: string[];
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState<string[]>(initialCategories);
  const [saved, setSaved] = useState(false);

  async function toggle(cat: string) {
    const next = blocked.includes(cat)
      ? blocked.filter((c) => c !== cat)
      : [...blocked, cat];
    setBlocked(next);
    setSaved(false);
    const { error } = await apiClient.oemUpdateFleet(fleetId, { blocked_categories: next });
    if (!error) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-border-soft bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base text-ink">Brand safety</h3>
        {saved && <span className="text-xs text-success">Saved</span>}
      </div>
      <div className="mt-1 font-mono text-label uppercase text-ink-3">
        Categories blocked on this fleet
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {CATEGORIES.map((cat) => (
          <label key={cat} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={blocked.includes(cat)}
              onChange={() => toggle(cat)}
              className="accent-rust"
            />
            {cat}
          </label>
        ))}
      </div>

      <div className="mt-6 rounded-md border border-dashed border-border-soft p-4">
        <p className="text-sm text-ink-3">
          Blocked advertisers — coming soon. You’ll be able to block specific advertiser orgs by
          name.
        </p>
      </div>
    </div>
  );
}
