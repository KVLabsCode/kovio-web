import { notFound, redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCount, formatMoney, formatRelative } from '@/lib/format';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import { MetricCard } from '@/components/MetricCard';
import Chart from '@/components/ChartClient';
import { Table, type Column } from '@/components/Table';
import { Pill } from '@/components/Pill';
import FleetApiKeys from '@/components/FleetApiKeys';
import FleetBrandSafety from '@/components/FleetBrandSafety';
import FleetEditButton from '@/components/FleetEditButton';
import type { FleetRobot } from '@/lib/types';

function robotVariant(status: string): 'live' | 'paused' | 'draft' {
  if (status === 'online') return 'live';
  if (status === 'offline') return 'paused';
  return 'draft';
}

export default async function FleetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, error } = await api.oemFleet(id);
  if (error?.status === 404) {
    if (error.code === 'not_onboarded') redirect('/onboarding');
    notFound();
  }
  if (error?.status === 403) redirect('/dashboard');
  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">
          Couldn’t load fleet: {error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const { fleet, robots, api_keys, stats } = data;
  const revSeries = stats.by_day.map((d) => ({ date: d.date, revenue: d.revenue_cents / 100 }));
  const revSpark = stats.by_day.slice(-14).map((d) => d.revenue_cents);
  const impSpark = stats.by_day.slice(-14).map((d) => d.impressions);
  const has30 = stats.impressions_30d > 0;

  const robotCols: Column<FleetRobot>[] = [
    {
      key: 'ext',
      label: 'External ID',
      render: (r) => <span className="font-mono text-ink">{r.external_id}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Pill variant={robotVariant(r.status)}>{r.status}</Pill>,
    },
    {
      key: 'hb',
      label: 'Last heartbeat',
      render: (r) => (r.last_heartbeat ? formatRelative(r.last_heartbeat) : '—'),
    },
    {
      key: 'reg',
      label: 'Registered',
      align: 'right',
      render: (r) => formatRelative(r.created_at),
    },
  ];

  return (
    <AppShell>
      <SectionHeader
        label={`FLEET · ${(fleet.region ?? 'GLOBAL').toUpperCase()}`}
        greeting={fleet.name}
        subtitle={`${robots.length} robots · ${api_keys.length} API keys · ${fleet.revenue_share_pct}% revenue share`}
        rightActions={<FleetEditButton fleetId={fleet.id} initialName={fleet.name} />}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <MetricCard label="ROBOTS" value={String(robots.length)} />
        <MetricCard
          label="IMPRESSIONS 30D"
          value={formatCount(stats.impressions_30d)}
          sparkline={has30 ? impSpark : undefined}
          sparklineColor="navy"
        />
        <MetricCard
          label="REVENUE 30D"
          value={formatMoney(stats.revenue_30d_cents)}
          sparkline={has30 ? revSpark : undefined}
          sparklineColor="rust"
        />
      </div>

      <div className="mt-6 rounded-lg border border-border-soft bg-card p-6">
        <h3 className="text-base text-ink">Revenue over time</h3>
        <div className="mt-1 font-mono text-label uppercase text-ink-3">Last 30 days</div>
        <div className="mt-4">
          <Chart
            data={revSeries}
            xKey="date"
            primaryKey="revenue"
            primaryLabel="Revenue"
            primaryFormat="usd"
          />
        </div>
      </div>

      <div className="mt-6">
        {robots.length === 0 ? (
          <div className="rounded-lg border border-border-soft bg-card p-6">
            <h3 className="text-base text-ink">Robots in this fleet</h3>
            <p className="mt-3 text-sm text-ink-3">
              No robots registered yet. Install the kovio SDK on a robot using an API key from the
              next section — the robot auto-registers on first heartbeat.
            </p>
          </div>
        ) : (
          <Table columns={robotCols} rows={robots} caption="Robots in this fleet" />
        )}
      </div>

      <div className="mt-6">
        <FleetApiKeys fleetId={fleet.id} initialKeys={api_keys} />
      </div>

      <div className="mt-6">
        <FleetBrandSafety fleetId={fleet.id} initialCategories={fleet.blocked_categories} />
      </div>
    </AppShell>
  );
}
