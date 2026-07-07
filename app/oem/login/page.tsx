'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { KovioMark } from '@/components/KovioMark';
import { emailError } from '@/lib/email-validation';

type Mode = 'signin' | 'signup';

// Left-panel value props for fleet operators (mirrors /oem/onboarding, trimmed
// to the split-panel format used on the advertiser /login).
const VALUE_PROPS: Array<{ title: string; body: string }> = [
  { title: 'A new revenue stream', body: 'Kovio fills the screens on your robots and splits the revenue with you.' },
  { title: 'Plug-and-play SDK', body: 'Mint a fleet key, drop in the SDK, and robots start earning in minutes.' },
  { title: 'You set the terms', body: 'Your revenue share, your allow/block lists. Faces never leave the robot.' },
];

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
    // Enforce a work email on registration; sign-in only needs a valid address
    // so existing fleet accounts are never locked out.
    const emailErr = emailError(email, isSignup);
    if (emailErr) {
      setError(emailErr);
      return;
    }
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
    <div className="flex min-h-screen bg-bg text-ink">
      {/* LEFT — fixed-dark brand panel (hidden on small screens) */}
      <div className="relative hidden min-w-0 flex-1 flex-col overflow-hidden bg-[#332c24] px-14 py-12 text-[#f1ead9] lg:flex">
        <div className="flex items-center gap-[11px]">
          <KovioMark className="h-6 w-6 text-[#d38b50]" />
          <span className="font-mono text-[16px] tracking-[0.18em]">KOVIO</span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-[#857b64]">/ FLEETS</span>
        </div>

        <div className="flex max-w-[480px] flex-1 flex-col justify-center">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#4b4231] px-[13px] py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#5cbe85]">
            <span className="k-pulse h-1.5 w-1.5 rounded-full bg-[#5cbe85]" /> Fleet network live
          </div>
          <h1 className="mt-[22px] font-serif text-[clamp(38px,4vw,56px)] font-medium leading-[1.04] tracking-[-0.02em]">
            Put your robots <em className="italic text-[#d38b50]">to work.</em>
          </h1>
          <p className="mt-5 text-[18px] leading-[1.55] text-[#b6ac95]">
            Turn the screens already rolling through the city into paid ad inventory — and earn a
            revenue share on every verified impression.
          </p>
          <div className="mt-10 flex flex-col gap-[18px]">
            {VALUE_PROPS.map((v, i) => (
              <div key={v.title} className="flex gap-[14px]">
                <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[#5c4527] font-mono text-[13px] text-[#d38b50]">
                  {i + 1}
                </div>
                <div>
                  <div className="text-[16px] font-semibold">{v.title}</div>
                  <div className="mt-0.5 text-[14px] text-[#b6ac95]">{v.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="font-mono text-[11px] tracking-[0.1em] text-[#857b64]">
          © 2026 KOVIO LABS · THE ROBOT ECONOMY
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex w-full flex-none items-center justify-center px-6 py-12 lg:w-[46%] lg:max-w-[620px]">
        <div className="w-full max-w-[380px]">
          {/* Brand mark for the mobile / narrow view where the left panel is hidden */}
          <div className="mb-8 flex items-center gap-[11px] lg:hidden">
            <KovioMark className="h-6 w-6 text-accent" />
            <span className="font-mono text-[15px] tracking-[0.18em] text-ink">KOVIO</span>
            <span className="font-mono text-[11px] tracking-[0.14em] text-faint">/ FLEETS</span>
          </div>

          {finishing ? (
            <p className="text-muted">Signing you in…</p>
          ) : sent ? (
            <div>
              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] bg-tint">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" className="text-accent-dark" />
                  <path d="m3 7 9 6 9-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent-dark" />
                </svg>
              </div>
              <h2 className="mt-[22px] font-serif text-[34px] font-medium tracking-[-0.01em]">Check your email.</h2>
              <p className="mt-3 text-[16px] leading-[1.5] text-muted">
                We sent a {isSignup ? 'registration' : 'sign-in'} link to{' '}
                <span className="font-semibold text-ink">{email}</span>. It expires in 15 minutes.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
                className="mt-[22px] text-[15px] text-accent-dark transition-colors hover:text-accent"
              >
                ← Use a different email
              </button>
            </div>
          ) : (
            <>
              {isSignup && (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-tint px-[13px] py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-dark">
                  ★ Earn on every verified impression
                </div>
              )}
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
                {isSignup ? 'Register your fleet' : 'Welcome back'}
              </div>
              <h2 className="mt-3 font-serif text-[36px] font-medium tracking-[-0.015em]">
                {isSignup ? 'Register your fleet.' : 'Welcome back, operator.'}
              </h2>
              <p className="mt-2 text-[16px] text-muted">
                {isSignup
                  ? 'Turn the screens on your robots into paid ad inventory.'
                  : 'Sign in to your fleet operator account.'}
              </p>

              <button
                type="button"
                onClick={handleGoogle}
                className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-[11px] border border-line-strong bg-panel py-[13px] text-[15px] text-ink transition-colors hover:border-accent"
              >
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                  <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                  <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.4 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z" />
                </svg>
                Continue with Google
              </button>

              <div className="my-[22px] flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">or</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={handleSubmit}>
                <label className="mb-2 block text-[14px] font-semibold">Work email</label>
                <input
                  type="email"
                  required
                  placeholder="you@robotics.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[11px] border border-line bg-field px-[15px] py-[14px] text-[15px] text-ink outline-none transition-colors focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-3 w-full rounded-[11px] bg-accent py-[14px] text-[15px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                >
                  {loading ? 'Sending…' : isSignup ? 'Register your fleet →' : 'Send magic link'}
                </button>
                {error && <p className="mt-3 text-sm text-danger">{error}</p>}
              </form>

              <p className="mt-[26px] text-center text-[15px] text-muted">
                {isSignup ? 'Already operate a fleet here? ' : 'New fleet operator? '}
                <button
                  type="button"
                  onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
                  className="text-accent-dark transition-colors hover:text-accent"
                >
                  {isSignup ? 'Sign in' : 'Register'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
