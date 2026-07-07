'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Claim-link control for any org (operator or advertiser). Copy-first:
// generate a /claim/<token> link straight to the clipboard (email optional —
// providing one locks the link to that address); emailing it is also available.
export default function InviteControl({
  orgId,
  pendingInvite,
  who,
}: {
  orgId: string;
  pendingInvite: string | null;
  who: string; // "OEM" | "advertiser" — button copy only
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'' | 'copy' | 'email'>('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function generate(send: boolean) {
    if (send && !email.trim()) {
      setError(`Enter the ${who}’s email to send it.`);
      return;
    }
    setBusy(send ? 'email' : 'copy');
    setError('');
    setNotice('');
    const res = await fetch('/api/admin/invite-operator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, email: email.trim() || undefined, send }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) {
      setError(json.error ?? 'Could not create the claim link.');
      return;
    }
    setLink(json.claimUrl ?? '');
    if (json.claimUrl) {
      try {
        await navigator.clipboard.writeText(json.claimUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {}
    }
    if (send) setNotice(json.emailed ? `Also emailed to ${email.trim()}.` : 'Email failed — share the copied link instead.');
    else setNotice(email.trim() ? `Link locked to ${email.trim()}.` : 'Open link — whoever claims it first gets the account.');
    router.refresh();
  }

  return (
    <div className="mt-2">
      {pendingInvite && !link && <p className="text-xs text-navy">Claim link pending ({pendingInvite})</p>}

      {open ? (
        <div className="mt-1.5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`${who} email (optional — locks the link to it)`}
              className="w-72 rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust"
            />
            <button
              onClick={() => generate(false)}
              disabled={!!busy}
              className="rounded-md bg-rust px-3 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
            >
              {busy === 'copy' ? 'Generating…' : copied ? 'Copied ✓' : 'Generate & copy link'}
            </button>
            <button
              onClick={() => generate(true)}
              disabled={!!busy}
              className="rounded-md border border-border-soft px-3 py-2 text-sm text-ink transition-colors hover:bg-page disabled:opacity-40"
            >
              {busy === 'email' ? 'Sending…' : 'Email it too'}
            </button>
            <button onClick={() => setOpen(false)} disabled={!!busy} className="text-sm text-ink-2 hover:text-ink">
              Close
            </button>
          </div>

          {link && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full break-all rounded-md border border-border-soft bg-page px-2.5 py-1.5 text-xs text-ink-2">
                {link}
              </code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  } catch {}
                }}
                className="rounded-md border border-border-soft px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-page"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          )}
          {notice && <p className="text-xs text-good">{notice}</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="text-sm text-rust transition-colors hover:text-rust-dark">
          {pendingInvite ? 'New claim link' : `+ Claim link for this ${who}`}
        </button>
      )}
    </div>
  );
}
