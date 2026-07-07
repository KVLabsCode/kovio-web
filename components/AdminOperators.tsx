'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import OemSettingsForm from '@/components/OemSettingsForm';
import type { MyOemTerms } from '@/lib/offers';

export interface AdminOperator {
  org_id: string;
  name: string;
  accepting: boolean;
  member_emails: string[];
  pending_invite: string | null;
}

// Per-operator claim-link control. Copy-first: generate a /claim/<token> link
// and copy it to share however you like (email optional — providing one locks
// the link to that address; emailing it from here is still available).
function InviteControl({ op }: { op: AdminOperator }) {
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
      setError('Enter the OEM’s email to send it.');
      return;
    }
    setBusy(send ? 'email' : 'copy');
    setError('');
    setNotice('');
    const res = await fetch('/api/admin/invite-operator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: op.org_id, email: email.trim() || undefined, send }),
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
      {op.pending_invite && !link && (
        <p className="text-xs text-navy">Claim link pending ({op.pending_invite})</p>
      )}

      {open ? (
        <div className="mt-1.5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="OEM email (optional — locks the link to it)"
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
          {op.pending_invite ? 'New claim link' : '+ Claim link for this OEM'}
        </button>
      )}
    </div>
  );
}

// Fleet operators with their receive-campaigns status. "Edit settings" lets an
// admin edit any operator's campaign settings with full parity (same form the
// operator sees, saved through the admin RPC).
export default function AdminOperators({ operators }: { operators: AdminOperator[] }) {
  const [openId, setOpenId] = useState('');
  const [terms, setTerms] = useState<MyOemTerms | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle(orgId: string) {
    if (openId === orgId) {
      setOpenId('');
      return;
    }
    setOpenId(orgId);
    setTerms(null);
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('kovio_admin_get_oem_terms', { p_org_id: orgId });
    setTerms(((Array.isArray(data) ? data[0] : data) as MyOemTerms | undefined) ?? null);
    setLoading(false);
  }

  return (
    <div className="grid gap-3">
      {operators.map((op) => (
        <div key={op.org_id} className="rounded-lg border border-border-soft bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-ink">{op.name}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs ${
                  op.accepting ? 'bg-good/10 text-good' : 'border border-border-soft text-ink-2'
                }`}
              >
                {op.accepting ? 'Accepting campaigns' : 'Not accepting'}
              </span>
              <span className="truncate text-xs text-ink-2">
                {op.member_emails.length > 0
                  ? `Accounts: ${op.member_emails.join(', ')}`
                  : 'No account associated — assign one from the Users table'}
              </span>
            </div>
            <button
              onClick={() => toggle(op.org_id)}
              className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-ink transition-colors hover:bg-page"
            >
              {openId === op.org_id ? 'Close' : 'Edit settings'}
            </button>
          </div>

          <InviteControl op={op} />

          {openId === op.org_id && (
            <div className="mt-4">
              {loading ? (
                <p className="text-sm text-ink-3">Loading settings…</p>
              ) : (
                <OemSettingsForm key={op.org_id} initial={terms} adminOrgId={op.org_id} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
