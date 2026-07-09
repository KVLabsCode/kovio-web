'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface MarketingLead {
  id: string;
  kind: 'trial' | 'fleet';
  name: string;
  email: string;
  company: string;
  fleet_info: string | null;
  creative_url: string | null;
  source_page: string | null;
  status: 'new' | 'contacted' | 'closed';
  created_at: string;
}

const STATUS_STYLE: Record<MarketingLead['status'], string> = {
  new: 'bg-rust/10 text-rust',
  contacted: 'bg-good/10 text-good',
  closed: 'border border-border-soft text-ink-2',
};

// Free-trial + fleet leads captured on kovio.dev (marketing site). Each signer
// already received the acknowledgment email; this list is the follow-up queue.
export default function AdminLeads({ leads }: { leads: MarketingLead[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');

  async function setStatus(lead: MarketingLead, status: MarketingLead['status']) {
    setBusy(lead.id);
    const supabase = createClient();
    await supabase.rpc('kovio_admin_update_lead', { p_id: lead.id, p_status: status });
    setBusy('');
    router.refresh();
  }

  if (leads.length === 0) {
    return (
      <p className="rounded-lg border border-border-soft bg-card px-4 py-3 text-sm text-ink-2">
        No sign-ups yet — they land here the moment someone submits the free-trial or fleet form on kovio.dev.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {leads.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-soft bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">{l.company}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${l.kind === 'trial' ? 'bg-rust/10 text-rust' : 'bg-tint text-ink-2'}`}>
                {l.kind === 'trial' ? 'Free trial' : 'Fleet'}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLE[l.status]}`}>{l.status}</span>
            </div>
            <div className="mt-0.5 text-xs text-ink-2">
              {l.name} · <a href={`mailto:${l.email}`} className="text-rust hover:text-rust-dark">{l.email}</a>
              {l.fleet_info ? ` · ${l.fleet_info}` : ''}
              {l.source_page ? ` · via /${l.source_page === 'home' ? '' : l.source_page}` : ''} ·{' '}
              {new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {l.creative_url && (
              <a
                href={l.creative_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-border-soft px-2.5 py-1.5 text-xs text-ink hover:bg-page"
              >
                View creative
              </a>
            )}
            <select
              value={l.status}
              disabled={busy === l.id}
              onChange={(e) => void setStatus(l, e.target.value as MarketingLead['status'])}
              className="rounded-md border border-border-soft bg-card px-2 py-1.5 text-xs text-ink outline-none"
            >
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="closed">closed</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
