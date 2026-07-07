'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { KovioMark } from '@/components/KovioMark';

interface ClaimInfo {
  org_name: string | null;
  invited_email_hint: string | null;
  valid: boolean;
  reason: string;
}

// Claim an operator account from an emailed invite link. Flow:
// 1. Show which org this claims (+ masked invited email).
// 2. Not signed in → magic-link sign-in that returns right here.
// 3. Signed in → one click runs kovio_claim_org (email must match the invite).
export default function ClaimClient({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const [{ data: infoRows }, { data: userData }] = await Promise.all([
        supabase.rpc('kovio_claim_info', { p_token: token }),
        supabase.auth.getUser(),
      ]);
      if (!alive) return;
      const row = Array.isArray(infoRows) ? infoRows[0] : infoRows;
      setInfo((row as ClaimInfo) ?? { org_name: null, invited_email_hint: null, valid: false, reason: 'not_found' });
      setSessionEmail(userData.user?.email ?? null);
      setLoadingInfo(false);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/claim/${token}`)}`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function claim() {
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_claim_org', { p_token: token });
    setBusy(false);
    if (error) {
      const msg = error.message || '';
      if (msg.includes('wrong_email'))
        setError(`This invite was sent to ${info?.invited_email_hint ?? 'a different email'} — sign in with that address.`);
      else if (msg.includes('already_claimed')) setError('This invite has already been used.');
      else if (msg.includes('claim_expired')) setError('This invite has expired — ask Kovio for a fresh one.');
      else setError('Could not claim the account. Please try again.');
      return;
    }
    router.push('/oem/dashboard');
    router.refresh();
  }

  const orgName = info?.org_name ?? 'your fleet';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-[11px]">
          <KovioMark className="h-6 w-6 text-accent" />
          <span className="font-mono text-[15px] tracking-[0.18em]">KOVIO</span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-faint">/ FLEETS</span>
        </div>

        {loadingInfo ? (
          <p className="mt-8 text-muted">Checking your invite…</p>
        ) : !info?.valid ? (
          <div className="mt-8">
            <h1 className="font-serif text-[32px] font-medium tracking-[-0.01em]">
              {info?.reason === 'already_claimed' ? 'Already claimed.' : info?.reason === 'expired' ? 'Invite expired.' : 'Invite not found.'}
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              {info?.reason === 'already_claimed'
                ? `The ${orgName} account has already been claimed. If that wasn’t you, contact Kovio.`
                : 'Ask your Kovio contact to send a fresh claim link.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-tint px-[13px] py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-dark">
              ★ Operator invite
            </div>
            <h1 className="mt-3 font-serif text-[34px] font-medium leading-[1.08] tracking-[-0.015em]">
              Claim <em className="italic text-accent">{orgName}</em> on Kovio.
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              {info.invited_email_hint ? (
                <>
                  This invite is for <span className="font-medium text-ink">{info.invited_email_hint}</span>. Sign in
                  with that email and the {orgName} operator account — campaign inbox, pricing, schedule and
                  earnings — is yours.
                </>
              ) : (
                <>
                  Sign in with your work email and the {orgName} operator account — campaign inbox, pricing,
                  schedule and earnings — is yours.
                </>
              )}
            </p>

            {sessionEmail ? (
              <div className="mt-7">
                <p className="text-[14px] text-muted">
                  Signed in as <span className="font-medium text-ink">{sessionEmail}</span>
                </p>
                <button
                  onClick={claim}
                  disabled={busy}
                  className="mt-3 w-full rounded-[11px] bg-accent py-[14px] text-[15px] font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                >
                  {busy ? 'Claiming…' : `Claim ${orgName} →`}
                </button>
                <form action="/auth/logout" method="post" className="mt-3 text-center">
                  <button className="text-[13px] text-muted transition-colors hover:text-ink">
                    Not you? Sign out and use the invited email
                  </button>
                </form>
              </div>
            ) : sent ? (
              <p className="mt-7 text-[15px] text-muted">
                Check your email — we sent a sign-in link to <span className="text-ink">{email}</span>. It brings
                you straight back here to finish claiming.
              </p>
            ) : (
              <form onSubmit={sendLink} className="mt-7">
                <label className="mb-2 block text-[14px] font-semibold">Your invited email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@robot.com"
                  className="w-full rounded-[11px] border border-line bg-field px-[15px] py-[14px] text-[15px] text-ink outline-none transition-colors focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-3 w-full rounded-[11px] bg-accent py-[14px] text-[15px] font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                >
                  {busy ? 'Sending…' : 'Send sign-in link'}
                </button>
              </form>
            )}
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
