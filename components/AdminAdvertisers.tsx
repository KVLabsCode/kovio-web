'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import InviteControl from '@/components/InviteControl';

export interface AdminAdvertiserOrg {
  org_id: string;
  name: string;
  member_emails: string[];
  pending_invite: string | null;
}

// Create a named org (advertiser or operator) from the admin dashboard, then
// hand it over with a claim link.
export function NewOrgControl({ kind, label }: { kind: 'advertiser' | 'oem'; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_create_org', { p_name: name.trim(), p_kind: kind });
    setBusy(false);
    if (error) {
      setError(error.message.includes('invalid_name') ? 'Give it a name.' : 'Could not create the organization.');
      return;
    }
    setName('');
    setOpen(false);
    router.refresh();
  }

  return open ? (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void create();
          }
        }}
        placeholder="e.g. Pylon"
        autoFocus
        className="w-56 rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust"
      />
      <button onClick={create} disabled={busy || !name.trim()} className="rounded-md bg-rust px-3 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40">
        {busy ? 'Creating…' : 'Create'}
      </button>
      <button onClick={() => setOpen(false)} disabled={busy} className="text-sm text-ink-2 hover:text-ink">
        Cancel
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  ) : (
    <button onClick={() => setOpen(true)} className="rounded-md border border-border-soft px-3 py-2 text-sm text-ink transition-colors hover:bg-page">
      {label}
    </button>
  );
}

// Advertiser orgs with their accounts + a claim-link control each — so a brand
// like Pylon can be set up here and handed over via /claim/<token>.
export default function AdminAdvertisers({ advertisers }: { advertisers: AdminAdvertiserOrg[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? advertisers : advertisers.slice(0, 8);

  return (
    <div className="grid gap-3">
      {visible.map((a) => (
        <div key={a.org_id} className="rounded-lg border border-border-soft bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-ink">{a.name}</span>
            <span className="truncate text-xs text-ink-2">
              {a.member_emails.length > 0
                ? `Accounts: ${a.member_emails.join(', ')}`
                : 'No account associated yet'}
            </span>
          </div>
          <InviteControl orgId={a.org_id} pendingInvite={a.pending_invite} who="advertiser" />
        </div>
      ))}
      {advertisers.length > 8 && (
        <button onClick={() => setShowAll((v) => !v)} className="text-sm text-ink-2 transition-colors hover:text-ink">
          {showAll ? 'Show fewer' : `Show all ${advertisers.length} advertisers`}
        </button>
      )}
    </div>
  );
}
