'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Manage the admin allowlist. Any listed email gets full /admin access after
// signing in at /admin/login. You can't remove yourself (so at least one admin
// always remains).
export default function AdminAdmins({ admins, myEmail }: { admins: string[]; myEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function add() {
    const v = email.trim().toLowerCase();
    if (!v) return;
    setBusy('add');
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_add_admin', { p_email: v });
    setBusy('');
    if (error) {
      setError(error.message.includes('invalid_email') ? 'Enter a valid email.' : 'Could not add the admin.');
      return;
    }
    setEmail('');
    router.refresh();
  }

  async function remove(target: string) {
    if (!confirm(`Remove ${target} as a Kovio admin?`)) return;
    setBusy(target);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_remove_admin', { p_email: target });
    setBusy('');
    if (error) {
      setError(error.message.includes('cannot_remove_self') ? 'You can’t remove yourself.' : 'Could not remove the admin.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border-soft bg-card p-5">
      <ul className="space-y-2">
        {admins.map((a) => (
          <li key={a} className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink">
              {a}
              {a === myEmail && <span className="ml-2 rounded-full bg-rust/10 px-2 py-0.5 text-[11px] text-rust">you</span>}
            </span>
            {a !== myEmail && (
              <button
                onClick={() => remove(a)}
                disabled={!!busy}
                className="text-sm text-danger transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {busy === a ? 'Removing…' : 'Remove'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2 border-t border-border-soft pt-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="new-admin@kovio.dev"
          className="flex-1 rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust"
        />
        <button
          onClick={add}
          disabled={busy === 'add' || !email.trim()}
          className="rounded-md bg-rust px-4 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
        >
          {busy === 'add' ? 'Adding…' : 'Add admin'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-3 text-xs text-ink-3">
        New admins sign in at <code className="text-ink-2">/admin/login</code> with this email (the account must
        already exist in Kovio — magic link or Google).
      </p>
    </div>
  );
}
