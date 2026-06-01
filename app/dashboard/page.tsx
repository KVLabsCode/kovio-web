import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCount, formatMoney } from '@/lib/format';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import { MetricCard } from '@/components/MetricCard';
import Chart from '@/components/Chart';
import { LiveActivityFeed, type ActivityEvent } from '@/components/LiveActivityFeed';
import type { RecentImpression } from '@/lib/types';

const RANGES = ['24h', '7d', '28d', '90d'];

function firstName(email: string): string {
  const local = (email.split('@')[0] || 'there').replace(/[^a-zA-Z]/g, '') || 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function greetingPrefix(): string {
  const h = new Date().getUTCHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Group last impressions into a per-day spend series (cents → dollars).
function dailySpend(imps: RecentImpression[]) {
  const map = new Map<string, number>();
  for (const imp of imps) {
    const d = imp.timestamp.slice(0, 10);
    map.set(d, (map.get(d) ?? 0) + imp.cost_cents);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cents]) => ({ date, spend: cents / 100 }));
}

const btnGhost =
  'inline-flex items-center rounded-md border border-border-soft px-4 py-2.5 text-sm text-ink-2 transition-colors duration-200 hover:text-ink';
const btnRust =
  'inline-flex items-center rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const activeRange = RANGES.includes(range ?? '') ? range! : '28d';

  const [dash, me, camps] = await Promise.all([api.dashboard(), api.me(), api.campaigns()]);
  if (dash.error?.status === 404) redirect('/onboarding');
  if (dash.error || !dash.data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">
          Couldn’t load your dashboard: {dash.error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const d = dash.data;
  const name = firstName(me.data?.user.email ?? '');
  const budgetTotal = (camps.data?.campaigns ?? []).reduce(
    (sum, c) => sum + c.budget_total_cents,
    0,
  );
  const series = dailySpend(d.recent_impressions);
  const spendSpark = series.map((p) => p.spend);
  const costPer1k =
    d.impressions_30d > 0 ? (d.spent_30d_cents / d.impressions_30d) * 1000 : null;

  const subtitle =
    d.total_campaigns === 0
      ? 'Your first campaign is one click away.'
      : `${d.active_campaigns} campaign${d.active_campaigns === 1 ? '' : 's'} live · ${formatCount(
          d.impressions_30d,
        )} impressions in the last 28 days.`;

  const activity: ActivityEvent[] = d.recent_impressions.map((imp, i) => ({
    id: `${imp.campaign_id}-${i}`,
    time: '·',
    type: 'impression',
    title: `Impression · ${imp.campaign_name}`,
    location: 'Across active fleet',
    value_cents: imp.cost_cents,
  }));

  return (
    <AppShell>
      <SectionHeader
        label="OVERVIEW · LAST 28 DAYS"
        greeting={`${greetingPrefix()}, ${name}.`}
        subtitle={subtitle}
        rangePills={RANGES}
        activePill={activeRange}
        rightActions={
          <>
            <button className={btnGhost} type="button">
              Export
            </button>
            <Link href="/campaigns/new" className={btnRust}>
              + New campaign
            </Link>
          </>
        }
      />

      {/* Six metric cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          label="SPEND"
          value={formatMoney(d.spent_30d_cents)}
          sparkline={spendSpark}
          sparklineColor="rust"
          context={budgetTotal > 0 ? `of ${formatMoney(budgetTotal)} budget` : 'no budget set'}
        />
        <MetricCard
          label="IMPRESSIONS"
          value={formatCount(d.impressions_30d)}
          context="across active robots"
        />
        {/* TODO: wire when engagement rate is in /advertiser/v1/dashboard response */}
        <MetricCard label="ENGAGEMENT RATE" value="—" context="industry avg 2.8%" />
        {/* TODO: wire when qr_scan counts are in /advertiser/v1/dashboard response */}
        <MetricCard label="QR SCANS" value="—" context="of impressions" />
        {/* TODO: wire when dwell duration is added to the event payload */}
        <MetricCard label="AVG DWELL" value="—" context="weighted across buckets" />
        <MetricCard
          label="COST / 1K VIEWS"
          value={costPer1k != null ? formatMoney(Math.round(costPer1k)) : '—'}
          context="last 28 days"
        />
      </div>

      {/* Chart + environment */}
      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border-soft bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base text-ink">Performance over time</h3>
            <div className="flex items-center gap-3 text-xs text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rust" /> Spend ($)
              </span>
            </div>
          </div>
          <div className="mt-1 font-mono text-label uppercase text-ink-3">
            Daily spend · 28 days
          </div>
          <div className="mt-4">
            <Chart
              data={series}
              xKey="date"
              primaryKey="spend"
              primaryLabel="Spend"
              primaryFormat={(v) => `$${v.toFixed(0)}`}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border-soft bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base text-ink">Performance by environment</h3>
            <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
            </span>
          </div>
          <div className="mt-1 font-mono text-label uppercase text-ink-3">
            Share of spend · scans · conversion
          </div>
          {/* TODO: wire when events_raw carries an environment dimension */}
          <div className="mt-6 space-y-2">
            <div className="h-2 w-full rounded-full bg-rust-soft">
              <div className="h-2 w-1/4 rounded-full bg-rust" />
            </div>
            <p className="text-sm text-ink-3">
              No environment data yet — first impressions land here.
            </p>
          </div>
        </div>
      </div>

      {/* Live activity */}
      <div className="mt-6">
        <LiveActivityFeed events={activity.slice(0, 10)} />
      </div>
    </AppShell>
  );
}
