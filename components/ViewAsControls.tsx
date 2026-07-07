'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Admin "view as": browse Kovio exactly as this org sees it. Your own org
// association is remembered and restored by StopViewing.
export function ViewAsButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('kovio_admin_view_as', { p_org_id: orgId });
    if (error) {
      setBusy(false);
      setError('Could not switch view.');
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    router.push(row?.kind === 'advertiser' ? '/dashboard' : '/oem/dashboard');
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={go}
        disabled={busy}
        className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-ink transition-colors hover:bg-page disabled:opacity-40"
      >
        {busy ? 'Switching…' : 'View dashboard →'}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

// Banner on /admin while a view-as session is active.
export function ViewingBanner({ orgName, kind }: { orgName: string; kind: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function stop() {
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc('kovio_admin_return');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-navy/30 bg-navy/5 px-4 py-3">
      <p className="text-sm text-ink">
        You’re currently viewing Kovio as <span className="font-semibold">{orgName}</span>{' '}
        <span className="text-ink-2">({kind === 'advertiser' ? 'advertiser' : 'operator'})</span> — their
        dashboard, campaigns and settings are live under your account.
      </p>
      <div className="flex items-center gap-2">
        <a
          href={kind === 'advertiser' ? '/dashboard' : '/oem/dashboard'}
          className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-ink transition-colors hover:bg-page"
        >
          Open their dashboard
        </a>
        <button
          onClick={stop}
          disabled={busy}
          className="rounded-md bg-rust px-3 py-1.5 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
        >
          {busy ? 'Returning…' : 'Stop viewing'}
        </button>
      </div>
    </div>
  );
}
