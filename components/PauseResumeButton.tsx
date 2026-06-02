'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function PauseResumeButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isActive = status === 'active';

  async function handleClick() {
    setLoading(true);
    setError('');
    const { error } = isActive
      ? await apiClient.pauseCampaign(id)
      : await apiClient.resumeCampaign(id);
    setLoading(false);
    if (error) {
      setError(error.code === 'budget_exhausted' ? 'Budget exhausted — top up first.' : error.detail ?? 'Failed.');
      return;
    }
    router.refresh();
  }

  const cls = isActive
    ? 'inline-flex items-center rounded-md border border-border-soft px-4 py-2.5 text-sm text-ink-2 transition-colors duration-200 hover:text-ink disabled:opacity-50'
    : 'inline-flex items-center rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark disabled:opacity-50';

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleClick} disabled={loading} className={cls}>
        {loading ? 'Saving…' : isActive ? 'Pause' : 'Resume'}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
