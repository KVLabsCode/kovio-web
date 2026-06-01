import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import { Table, type Column } from '@/components/Table';
import { Pill, statusVariant } from '@/components/Pill';
import type { Campaign } from '@/lib/types';

const btnRust =
  'inline-flex items-center rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark';

export default async function CampaignsPage() {
  const { data, error } = await api.campaigns();
  if (error?.status === 404) redirect('/onboarding');
  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">
          Couldn’t load campaigns: {error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const campaigns = data.campaigns;
  const live = campaigns.filter((c) => c.status === 'active').length;
  const paused = campaigns.filter((c) => c.status === 'paused').length;
  const draft = campaigns.filter((c) => c.status === 'draft').length;

  const columns: Column<Campaign>[] = [
    { key: 'name', label: 'Campaign', render: (c) => <span className="text-ink">{c.name}</span> },
    { key: 'env', label: 'Environment', render: () => <span className="text-ink-2">All robots</span> },
    {
      key: 'status',
      label: 'Status',
      render: (c) => <Pill variant={statusVariant(c.status)}>{c.status}</Pill>,
    },
    {
      key: 'spend',
      label: 'Spend',
      align: 'right',
      render: (c) => formatMoney(c.budget_spent_cents),
    },
    // Impressions / ER / Scans / CPE come from data not yet in the campaigns
    // list response — placeholders until the backend exposes them.
    { key: 'impr', label: 'Impr.', align: 'right', render: () => <span className="text-ink-3">—</span> },
    { key: 'er', label: 'ER', align: 'right', render: () => <span className="text-ink-3">—</span> },
    { key: 'scans', label: 'Scans', align: 'right', render: () => <span className="text-ink-3">—</span> },
    { key: 'cpe', label: 'CPE', align: 'right', render: () => <span className="text-ink-3">—</span> },
  ];

  return (
    <AppShell>
      <SectionHeader
        label="CAMPAIGNS"
        greeting="Your campaigns."
        subtitle="Manage all running, paused, and draft campaigns."
        rightActions={
          <Link href="/campaigns/new" className={btnRust}>
            + New campaign
          </Link>
        }
      />

      <div className="mt-8">
        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-border-soft bg-card p-10 text-center">
            <h3 className="font-serif text-h2 text-ink">No campaigns yet</h3>
            <p className="mt-2 text-ink-2">Your first campaign takes about two minutes.</p>
            <Link href="/campaigns/new" className={`${btnRust} mt-6`}>
              + New campaign
            </Link>
          </div>
        ) : (
          <Table
            columns={columns}
            rows={campaigns}
            caption="Your campaigns"
            meta={`${campaigns.length} total · ${live} live · ${paused} paused · ${draft} draft`}
            rowHref={(c) => `/campaigns/${c.id}`}
          />
        )}
      </div>
    </AppShell>
  );
}
