'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ViewAsButton } from '@/components/ViewAsControls';

export interface AdminAdvertiserOrg {
  org_id: string;
  name: string;
  member_emails: string[];
  pending_invite: string | null;
  claimed_at: string | null;
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

// Inline org rename: pencil → input → save.
export function RenameOrg({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!value.trim() || value.trim() === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc('kovio_admin_rename_org', { p_org_id: orgId, p_name: value.trim() });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-sm font-medium text-ink">{name}</span>
        <button
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          aria-label={`Rename ${name}`}
          className="text-ink-3 transition-colors hover:text-ink"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinejoin="round" />
            <path d="m13.5 6.5 3 3" />
          </svg>
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void save();
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
        className="w-44 rounded-md border border-border-soft bg-card px-2 py-1 text-sm text-ink outline-none focus:border-rust"
      />
      <button onClick={save} disabled={busy} className="text-xs text-rust hover:text-rust-dark disabled:opacity-50">
        {busy ? '…' : 'Save'}
      </button>
      <button onClick={() => setEditing(false)} disabled={busy} className="text-xs text-ink-3 hover:text-ink">
        Cancel
      </button>
    </span>
  );
}

// Delete an org + its app data (blocked when real activity exists).
export function DeleteOrgButton({ orgId, name, small }: { orgId: string; name: string; small?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function del() {
    if (!confirm(`Delete ${name} and all its campaigns, showcases, offers and claim links? This can't be undone.`)) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_delete_org', { p_org_id: orgId });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes('org_has_activity')
          ? 'This org has real activity (impressions/transactions) — not deletable from here.'
          : 'Could not delete.',
      );
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={del}
        disabled={busy}
        className={
          small
            ? 'text-xs text-danger transition-opacity hover:opacity-80 disabled:opacity-40'
            : 'rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-40'
        }
      >
        {busy ? 'Deleting…' : small ? 'Delete' : `Delete ${name}`}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <RenameOrg orgId={a.org_id} name={a.name} />
              {a.member_emails.length > 0 ? (
                <span className="rounded-full bg-good/10 px-2.5 py-1 text-xs text-good">
                  ✓ Claimed by {a.member_emails.join(', ')}
                  {a.claimed_at
                    ? ` · ${new Date(a.claimed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : ''}
                </span>
              ) : a.pending_invite ? (
                <span className="rounded-full bg-navy/10 px-2.5 py-1 text-xs text-navy">
                  Claim link pending ({a.pending_invite})
                </span>
              ) : (
                <span className="rounded-full border border-border-soft px-2.5 py-1 text-xs text-ink-2">Not claimed yet</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/advertisers/${a.org_id}`}
                className="rounded-md bg-rust px-3 py-1.5 text-sm text-page transition-colors hover:bg-rust-dark"
              >
                Showcase &amp; claim →
              </Link>
              <ViewAsButton orgId={a.org_id} />
            </div>
          </div>
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
