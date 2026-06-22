'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

// Persisted so a fleet operator who authenticates is routed to OEM onboarding
// even if Supabase falls back to the Site URL and drops the redirect's ?next=.
// Root (app/page.tsx) reads this when a freshly-authenticated user has no org.
function markOemIntent() {
  document.cookie = 'kovio_onboard_kind=oem; path=/; max-age=3600; samesite=lax';
}

export default function OemLoginPage() {
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

  const isSignup = mode === 'signup';
  const NEXT = '/oem/onboarding';

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      setFinishing(true);
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setSent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    markOemIntent();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(NEXT)}`,
        shouldCreateUser: isSignup,
      },
    });
    setLoading(false);
    if (error) {
      if (!isSignup && /signups? not allowed|user not found|not exist/i.test(error.message)) {
        setError('No fleet account with that email. Try registering instead.');
      } else {
        setError(error.message);
      }
    } else {
      setSent(true);
    }
  }

  async function handleGoogle() {
    setError('');
    markOemIntent();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(NEXT)}`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="font-mono text-xs uppercase tracking-wider text-ink-3">Kovio for fleets</div>

        {finishing ? (
          <p className="mt-6 text-ink-2">Signing you in…</p>
        ) : sent ? (
          <div className="mt-6">
            <h1 className="font-serif text-h2 text-ink">Check your email.</h1>
            <p className="mt-2 text-ink-2">
              We sent a {isSignup ? 'registration' : 'sign-in'} link to{' '}
              <span className="text-ink">{email}</span>.
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
            <h1 className="mt-6 font-serif text-h1 text-ink">
              {isSignup ? 'Register your fleet.' : 'Welcome back, operator.'}
            </h1>
            <p className="mt-2 text-ink-2">
              {isSignup
                ? 'Turn the screens on your robots into paid ad inventory.'
                : 'Sign in to your fleet operator account.'}
            </p>

            <button
              type="button"
              onClick={handleGoogle}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border-mid bg-card py-3 text-sm text-ink transition-colors hover:border-rust"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.4 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border-mid" />
              <span className="font-mono text-xs uppercase tracking-wider text-ink-3">or</span>
              <div className="h-px flex-1 bg-border-mid" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                placeholder="you@robotics.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border-mid bg-card px-3 py-3 text-sm text-ink transition-colors focus:border-rust focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-rust py-3 text-sm text-page transition-colors duration-200 hover:bg-rust-dark disabled:opacity-50"
              >
                {loading ? 'Sending…' : isSignup ? 'Register with email' : 'Send magic link'}
              </button>
              {error && <p className="text-sm text-danger">{error}</p>}
            </form>

            <p className="mt-6 text-center text-sm text-ink-2">
              {isSignup ? 'Already operate a fleet here? ' : 'New fleet operator? '}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
                className="text-rust transition-colors hover:text-rust-dark"
              >
                {isSignup ? 'Sign in' : 'Register'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
