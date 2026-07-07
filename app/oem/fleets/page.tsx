import Link from 'next/link';
import { redirect } from 'next/navigation';
import { redirectMissingOrg } from '@/lib/org-redirect';
import { api } from '@/lib/api';
import { formatCount, formatMoney } from '@/lib/format';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import { Table, type Column } from '@/components/Table';
import type { Fleet } from '@/lib/types';

const btnRust =
  'inline-flex items-center rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark';

export default async function OemFleetsPage() {
  const { data, error } = await api.oemFleets();
  if (error?.status === 404) await redirectMissingOrg('oem');
  if (error?.status === 403) redirect('/dashboard');
  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">
          Couldn’t load fleets: {error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const fleets = data.fleets;
  const columns: Column<Fleet>[] = [
    { key: 'name', label: 'Name', render: (f) => <span className="text-ink">{f.name}</span> },
    { key: 'region', label: 'Region', render: (f) => <span className="text-ink-2">{f.region ?? '—'}</span> },
    { key: 'robots', label: 'Robots', align: 'right', render: (f) => f.robot_count ?? 0 },
    {
      key: 'imp',
      label: 'Impr. 24h',
      align: 'right',
      render: (f) => formatCount(f.impressions_24h ?? 0),
    },
    {
      key: 'rev',
      label: 'Revenue 24h',
      align: 'right',
      render: (f) => (
        <span className="text-rust">{formatMoney(f.revenue_24h_cents ?? 0)}</span>
      ),
    },
  ];

  return (
    <AppShell>
      <SectionHeader
        label="FLEETS"
        greeting="Your fleets."
        subtitle="Manage robots, mint API keys, control brand safety."
        rightActions={
          <Link href="/oem/fleets/new" className={btnRust}>
            + Create fleet
          </Link>
        }
      />

      <div className="mt-8">
        {fleets.length === 0 ? (
          <div className="rounded-lg border border-border-soft bg-card p-10 text-center">
            <h3 className="font-serif text-h2 text-ink">No fleets yet</h3>
            <p className="mt-2 text-ink-2">
              Create your first fleet, then mint an API key, then install the kovio SDK on a robot
              using that key.
            </p>
            <Link href="/oem/fleets/new" className={`${btnRust} mt-6`}>
              + Create fleet
            </Link>
          </div>
        ) : (
          <Table
            columns={columns}
            rows={fleets}
            caption="Your fleets"
            meta={`${fleets.length} fleet${fleets.length === 1 ? '' : 's'}`}
            rowHref={(f) => `/oem/fleets/${f.id}`}
          />
        )}
      </div>
    </AppShell>
  );
}
