'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';

const PRESETS_CENTS = [2500, 10000, 50000];

export default function DepositPage() {
  const router = useRouter();
  const [customUsd, setCustomUsd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newBalance, setNewBalance] = useState<number | null>(null);

  async function deposit(amountCents: number) {
    setLoading(true);
    setError('');
    setNewBalance(null);
    const { data, error } = await apiClient.deposit(amountCents);
    setLoading(false);
    if (error) {
      if (error.code === 'amount_too_large') setError('Amount exceeds the $10,000 cap.');
      else if (error.code === 'invalid_amount') setError('Enter an amount greater than $0.');
      else setError(error.detail ?? 'Something went wrong.');
      return;
    }
    setNewBalance(data!.balance_cents);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Add funds</h1>

      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        💡 Mock deposit for testing. Real Stripe integration coming soon.
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PRESETS_CENTS.map((cents) => (
          <button
            key={cents}
            onClick={() => deposit(cents)}
            disabled={loading}
            className="rounded border border-gray-300 px-3 py-3 text-sm font-medium disabled:opacity-50"
          >
            {formatMoney(cents)}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          deposit(Math.round(parseFloat(customUsd || '0') * 100));
        }}
        className="space-y-3"
      >
        <label className="block text-sm font-medium">Custom amount (USD)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={customUsd}
          onChange={(e) => setCustomUsd(e.target.value)}
          placeholder="100.00"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !customUsd}
          className="w-full rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Processing…' : 'Deposit'}
        </button>
      </form>

      {newBalance !== null && (
        <p className="text-sm text-green-700">
          Deposit complete. New balance: <strong>{formatMoney(newBalance)}</strong>.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
