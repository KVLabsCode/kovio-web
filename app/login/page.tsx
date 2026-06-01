'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="mb-1 text-2xl font-bold">Kovio</h1>
      <p className="mb-6 text-sm text-gray-600">Advertiser portal — sign in with a magic link.</p>

      {sent ? (
        <div className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Check your email — we sent a magic link to <strong>{email}</strong>. Click it to sign in.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
