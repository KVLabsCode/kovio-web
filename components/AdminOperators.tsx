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

// Per-operator "send claim link" control: emails the OEM a /claim/<token> link
// that hands them the account when they sign in with that email.
function InviteControl({ op }: { op: AdminOperator }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function send() {
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/invite-operator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: op.org_id, email: email.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? 'Could not send the invite.');
      return;
    }
    setResult(json.emailed ? `Invite emailed to ${email.trim()}.` : `Invite created — email failed, share the link manually: ${json.claimUrl}`);
    setEmail('');
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mt-2">
      {op.pending_invite && !result && (
        <p className="text-xs text-navy">Invite pending: {op.pending_invite}</p>
      )}
      {result && <p className="break-all text-xs text-good">{result}</p>}
      {open ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="operator@robot.com"
            className="w-64 rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust"
          />
          <button onClick={send} disabled={busy || !email.trim()} className="rounded-md bg-rust px-3 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40">
            {busy ? 'Sending…' : 'Send claim link'}
          </button>
          <button onClick={() => setOpen(false)} disabled={busy} className="text-sm text-ink-2 hover:text-ink">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="text-sm text-rust transition-colors hover:text-rust-dark">
          {op.pending_invite ? 'Resend / new claim link' : '+ Send claim link to the OEM'}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
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
