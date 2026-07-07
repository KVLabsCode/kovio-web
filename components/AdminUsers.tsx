'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface AdminUserRow {
  email: string;
  org_id: string | null;
  org_name: string | null;
  kind: string | null;
  role: string | null;
  created_at: string;
}
export interface AdminOrg {
  org_id: string;
  name: string;
  kind: string;
}

// All users, with an org-association control per row. The headline use: pick an
// account and associate it with Robot.com so that account receives Robot.com's
// incoming campaigns (inbox, emails, accept/reschedule/comment).
function Row({ user, orgs }: { user: AdminUserRow; orgs: AdminOrg[] }) {
  const router = useRouter();
  const [target, setTarget] = useState(user.org_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changed = target && target !== (user.org_id ?? '');
  const targetOrg = orgs.find((o) => o.org_id === target);

  async function assign() {
    if (!changed) return;
    if (
      !confirm(
        `Associate ${user.email} with ${targetOrg?.name ?? 'this organization'}? ` +
          `They'll act for that organization the next time they load the app.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_assign_user_org', {
      p_email: user.email,
      p_org_id: target,
    });
    setBusy(false);
    if (error) {
      setError(error.message.includes('user_not_found') ? 'User not found.' : 'Could not assign.');
      return;
    }
    router.refresh();
  }

  async function deleteUser() {
    if (
      !confirm(
        `Delete ${user.email}? Their placed campaigns, comments and links are removed too. This can't be undone.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_delete_user', { p_email: user.email });
    setBusy(false);
    if (error) {
      setError(error.message.includes('cannot_delete_admin') ? 'That account is a Kovio admin.' : 'Could not delete.');
      return;
    }
    router.refresh();
  }

  return (
    <tr className="border-t border-border-soft">
      <td className="px-4 py-2.5 text-ink">{user.email}</td>
      <td className="px-4 py-2.5 text-ink-2">
        {user.org_name ?? '—'}
        {user.kind && <span className="ml-1.5 text-xs text-ink-3">({user.kind})</span>}
      </td>
      <td className="px-4 py-2.5 text-ink-2">{user.role ?? '—'}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-md border border-border-soft bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-rust"
          >
            <option value="">— no organization —</option>
            {orgs.map((o) => (
              <option key={o.org_id} value={o.org_id}>
                {o.name} · {o.kind}
              </option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={!changed || busy}
            className="rounded-md bg-rust px-3 py-1.5 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
          >
            {busy ? 'Assigning…' : 'Assign'}
          </button>
          <button
            onClick={deleteUser}
            disabled={busy}
            className="text-xs text-danger transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}

export default function AdminUsers({ users, orgs }: { users: AdminUserRow[]; orgs: AdminOrg[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-soft">
      <table className="w-full text-sm">
        <thead className="bg-card text-left text-xs uppercase tracking-wide text-ink-3">
          <tr>
            <th className="px-4 py-2.5">Email</th>
            <th className="px-4 py-2.5">Organization</th>
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Associate with</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Row key={u.email} user={u} orgs={orgs} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
