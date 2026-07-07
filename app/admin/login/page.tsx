'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { KovioMark } from '@/components/KovioMark';

// Private Kovio staff login. Access is gated by the admin_emails allowlist
// (checked server-side on /admin), so signing in here only reaches the admin
// dashboard for allowlisted accounts.
const NEXT = '/admin';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      setFinishing(true);
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(NEXT)}`);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(NEXT)}`, shouldCreateUser: false },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function handleGoogle() {
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(NEXT)}` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#211d18] px-4 text-[#f1ead9]">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-[11px]">
          <KovioMark className="h-6 w-6 text-[#d38b50]" />
          <span className="font-mono text-[16px] tracking-[0.18em]">KOVIO</span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-[#857b64]">/ ADMIN</span>
        </div>

        {finishing ? (
          <p className="mt-8 text-[#b6ac95]">Signing you in…</p>
        ) : sent ? (
          <div className="mt-8">
            <h1 className="font-serif text-[30px] font-medium">Check your email.</h1>
            <p className="mt-2 text-[15px] text-[#b6ac95]">
              We sent a sign-in link to <span className="text-[#f1ead9]">{email}</span>.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-8 font-serif text-[32px] font-medium tracking-[-0.01em]">Staff sign-in.</h1>
            <p className="mt-2 text-[15px] text-[#b6ac95]">Restricted to Kovio administrators.</p>

            <button
              type="button"
              onClick={handleGoogle}
              className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-[11px] border border-[#4b4231] bg-[#2a2519] py-[13px] text-[15px] text-[#f1ead9] transition-colors hover:border-[#d38b50]"
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
              <div className="h-px flex-1 bg-[#4b4231]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#857b64]">or</span>
              <div className="h-px flex-1 bg-[#4b4231]" />
            </div>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                required
                placeholder="you@kovio.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[11px] border border-[#4b4231] bg-[#2a2519] px-[15px] py-[14px] text-[15px] text-[#f1ead9] outline-none transition-colors placeholder:text-[#857b64] focus:border-[#d38b50]"
              />
              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full rounded-[11px] bg-[#d38b50] py-[14px] text-[15px] font-medium text-[#211d18] transition-colors hover:bg-[#bc6f37] disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
              {error && <p className="mt-3 text-sm text-[#e07a5f]">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
