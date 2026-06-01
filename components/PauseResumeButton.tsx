'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function PauseResumeButton({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
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
      if (error.code === 'budget_exhausted') {
        setError('Budget exhausted — top up before resuming.');
      } else {
        setError(error.detail ?? 'Something went wrong.');
      }
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Saving…' : isActive ? 'Pause' : 'Resume'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
