'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

  // Magic-link code that lands here (Supabase Site-URL fallback + proxy forward)
  // gets handed to the callback route that exchanges it for a session.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      setFinishing(true);
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    }
  }, []);

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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="font-mono text-xs uppercase tracking-wider text-ink-3">Kovio</div>

        {finishing ? (
          <p className="mt-6 text-ink-2">Signing you in…</p>
        ) : sent ? (
          <div className="mt-6">
            <h1 className="font-serif text-h2 text-ink">Check your email.</h1>
            <p className="mt-2 text-ink-2">
              We sent a link to <span className="text-ink">{email}</span>.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
              className="mt-4 text-sm text-rust transition-colors hover:text-rust-dark"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-serif text-h1 text-ink">Welcome back.</h1>
            <p className="mt-2 text-ink-2">Sign in with a magic link sent to your email.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border-mid bg-card px-3 py-3 text-sm text-ink transition-colors focus:border-rust focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-rust py-3 text-sm text-page transition-colors duration-200 hover:bg-rust-dark disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
