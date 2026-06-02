'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';

const PRESETS_CENTS = [2500, 10000, 50000];

export default function DepositForm() {
  const router = useRouter();
  const [amountCents, setAmountCents] = useState<number>(10000);
  const [customUsd, setCustomUsd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ added: number; balance: number } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error } = await apiClient.deposit(amountCents);
    setLoading(false);
    if (error) {
      if (error.code === 'amount_too_large') setError('Amount exceeds the $10,000 cap.');
      else if (error.code === 'invalid_amount') setError('Enter an amount greater than $0.');
      else setError(error.detail ?? 'Something went wrong.');
      return;
    }
    setDone({ added: amountCents, balance: data!.balance_cents });
    router.refresh();
  }

  if (done) {
    return (
      <div className="max-w-md rounded-lg border border-border-soft bg-card p-6">
        <h3 className="font-serif text-h2 text-ink">Added {formatMoney(done.added)}.</h3>
        <p className="mt-2 text-ink-2">
          New balance: <span className="text-ink">{formatMoney(done.balance)}</span>.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-rust transition-colors hover:text-rust-dark"
        >
          Back to dashboard →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <div className="grid grid-cols-3 gap-3">
        {PRESETS_CENTS.map((cents) => {
          const selected = amountCents === cents && !customUsd;
          return (
            <button
              key={cents}
              type="button"
              onClick={() => {
                setAmountCents(cents);
                setCustomUsd('');
              }}
              className={`rounded-lg border py-8 text-lg transition-colors duration-200 ${
                selected
                  ? 'border-rust bg-rust-soft text-rust-dark'
                  : 'border-border-soft bg-card text-ink hover:bg-card-hover'
              }`}
            >
              {formatMoney(cents)}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm text-ink-2">Custom amount (USD)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={customUsd}
          onChange={(e) => {
            setCustomUsd(e.target.value);
            setAmountCents(Math.round(parseFloat(e.target.value || '0') * 100));
          }}
          placeholder="100.00"
          className="w-full rounded-md border border-border-mid bg-card px-4 py-2.5 text-sm text-ink transition-colors focus:border-rust focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading || amountCents <= 0}
        className="mt-4 w-full rounded-md bg-rust py-3 text-sm text-page transition-colors duration-200 hover:bg-rust-dark disabled:opacity-50"
      >
        {loading ? 'Processing…' : `Add ${formatMoney(amountCents > 0 ? amountCents : 0)} to balance`}
      </button>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}
