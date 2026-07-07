'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { KovioMark } from '@/components/KovioMark';
import ShowcaseResults from '@/components/ShowcaseResults';
import type { ShowcaseCampaign } from '@/lib/showcase';

interface ClaimInfo {
  org_name: string | null;
  org_kind: string | null;
  invited_email_hint: string | null;
  valid: boolean;
  reason: string;
}

// Claim an org account from an invite link. When the org has showcase
// campaigns (prospect advertisers like Pylon), the page opens as a full
// results report with the claim CTA at the bottom; otherwise it's a simple
// claim card. Flow either way:
// 1. Not signed in → magic-link sign-in that returns right here.
// 2. Signed in → one click runs kovio_claim_org → their dashboard.
export default function ClaimClient({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [showcases, setShowcases] = useState<ShowcaseCampaign[]>([]);
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
      const [{ data: infoRows }, { data: showRows }, { data: userData }] = await Promise.all([
        supabase.rpc('kovio_claim_info', { p_token: token }),
        supabase.rpc('kovio_claim_showcases', { p_token: token }),
        supabase.auth.getUser(),
      ]);
      if (!alive) return;
      const row = Array.isArray(infoRows) ? infoRows[0] : infoRows;
      setInfo(
        (row as ClaimInfo) ?? { org_name: null, org_kind: null, invited_email_hint: null, valid: false, reason: 'not_found' },
      );
      setShowcases((showRows as ShowcaseCampaign[]) ?? []);
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
    // Survive Supabase's Site-URL fallback: if the magic link drops ?next=, the
    // root router reads this cookie and brings them back here to finish the
    // claim instead of pushing a fresh, org-less account into onboarding.
    document.cookie = `kovio_claim_token=${encodeURIComponent(token)}; path=/; max-age=3600; samesite=lax`;
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
    const { data, error } = await supabase.rpc('kovio_claim_org', { p_token: token });
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
    // Claim complete — the intent cookie has done its job.
    document.cookie = 'kovio_claim_token=; path=/; max-age=0';
    const claimed = Array.isArray(data) ? data[0] : data;
    router.push(claimed?.kind === 'advertiser' ? '/dashboard' : '/oem/dashboard');
    router.refresh();
  }

  const orgName = info?.org_name ?? 'your organization';
  const isAdv = info?.org_kind === 'advertiser';
  const hasShowcase = showcases.length > 0 && !!info?.valid;

  // The claim action block — shared by both layouts.
  const claimBody = sessionEmail ? (
    <div>
      <p className="text-[14px] text-muted">
        Signed in as <span className="font-medium text-ink">{sessionEmail}</span>
      </p>
      <button
        onClick={claim}
        disabled={busy}
        className="mt-3 w-full rounded-[11px] bg-accent py-[15px] text-[16px] font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
      >
        {busy ? 'Claiming…' : `Claim your ${orgName} account →`}
      </button>
      <form action="/auth/logout" method="post" className="mt-3 text-center">
        <button className="text-[13px] text-muted transition-colors hover:text-ink">
          Not you? Sign out and use the invited email
        </button>
      </form>
    </div>
  ) : sent ? (
    <p className="text-[15px] text-muted">
      Check your email — we sent a sign-in link to <span className="text-ink">{email}</span>. It brings you
      straight back here to finish claiming.
    </p>
  ) : (
    <form onSubmit={sendLink}>
      <label className="mb-2 block text-left text-[14px] font-semibold">
        {info?.invited_email_hint ? 'Your invited email' : 'Your work email'}
      </label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={isAdv ? 'you@yourbrand.com' : 'you@robot.com'}
        className="w-full rounded-[11px] border border-line bg-field px-[15px] py-[14px] text-[15px] text-ink outline-none transition-colors focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-[11px] bg-accent py-[15px] text-[16px] font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
      >
        {busy ? 'Sending…' : `Claim your ${orgName} account →`}
      </button>
    </form>
  );

  // ---- Showcase layout: full results report, sticky claim bar at the bottom -
  if (!loadingInfo && hasShowcase) {
    return (
      <div className="min-h-screen bg-bg text-ink">
        <div className="mx-auto max-w-[900px] px-5 pb-36 pt-10 sm:px-8">
          {/* Blurred until claimed — claiming redirects to their dashboard,
              where the full report renders sharp. */}
          <ShowcaseResults orgName={orgName} campaigns={showcases} locked />
        </div>

        {/* sticky claim bar */}
        <div id="claim-bar" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
          <div className="mx-auto max-w-[900px] px-5 py-3.5 sm:px-8">
            {sessionEmail ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[14px] text-muted">
                  Signed in as <span className="font-medium text-ink">{sessionEmail}</span> — everything above
                  is yours to run for real.
                </p>
                <div className="flex items-center gap-3">
                  <form action="/auth/logout" method="post">
                    <button className="text-[12px] text-muted transition-colors hover:text-ink">Not you?</button>
                  </form>
                  <button
                    onClick={claim}
                    disabled={busy}
                    className="rounded-[11px] bg-accent px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                  >
                    {busy ? 'Claiming…' : `Claim your ${orgName} dashboard →`}
                  </button>
                </div>
              </div>
            ) : sent ? (
              <p className="text-center text-[13px] text-ink">
                Check your inbox — we sent a secure sign-in link to{' '}
                <span className="font-semibold">{email}</span>. Open it to save your {orgName} dashboard.
              </p>
            ) : (
              <form onSubmit={sendLink} className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-[200px] text-[14px] text-ink">
                  <span className="font-semibold">This {orgName} dashboard is ready for you.</span>{' '}
                  <span className="text-muted">
                    {info?.invited_email_hint ? `Invite for ${info.invited_email_hint}.` : 'Claim it with your work email.'}
                  </span>
                </p>
                <div className="flex flex-1 items-center justify-end gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourbrand.com"
                    className="w-full max-w-[260px] rounded-[11px] border border-line bg-field px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="shrink-0 rounded-[11px] bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : `Claim ${orgName} →`}
                  </button>
                </div>
              </form>
            )}
            {error && <p className="mt-2 text-center text-[13px] text-danger">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ---- Simple claim card (no showcase) --------------------------------------
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-[11px]">
          <KovioMark className="h-6 w-6 text-accent" />
          <span className="font-mono text-[15px] tracking-[0.18em]">KOVIO</span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-faint">{isAdv ? '/ ADVERTISERS' : '/ FLEETS'}</span>
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
              ★ {isAdv ? 'Advertiser' : 'Operator'} invite
            </div>
            <h1 className="mt-3 font-serif text-[34px] font-medium leading-[1.08] tracking-[-0.015em]">
              Claim <em className="italic text-accent">{orgName}</em> on Kovio.
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              {info.invited_email_hint ? (
                <>
                  This invite is for <span className="font-medium text-ink">{info.invited_email_hint}</span>. Sign in
                  with that email and the {orgName} {isAdv ? 'advertiser' : 'operator'} account —{' '}
                  {isAdv ? 'campaigns on real robots, live insights and billing' : 'campaign inbox, pricing, schedule and earnings'} — is yours.
                </>
              ) : (
                <>
                  Sign in with your work email and the {orgName} {isAdv ? 'advertiser' : 'operator'} account —{' '}
                  {isAdv ? 'campaigns on real robots, live insights and billing' : 'campaign inbox, pricing, schedule and earnings'} — is yours.
                </>
              )}
            </p>
            <div className="mt-7">{claimBody}</div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
