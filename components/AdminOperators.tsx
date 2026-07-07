'use client';

import { useState } from 'react';
import InviteControl from '@/components/InviteControl';
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

          <InviteControl orgId={op.org_id} pendingInvite={op.pending_invite} who="OEM" />

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
