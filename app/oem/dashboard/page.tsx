import Link from 'next/link';
import { redirect } from 'next/navigation';
import { redirectMissingOrg } from '@/lib/org-redirect';
import { api } from '@/lib/api';
import { formatCount, formatMoney, formatRelative, formatPct } from '@/lib/format';
import AppShell from '@/components/AppShell';
import OnboardingTour from '@/components/OnboardingTour';
import { SectionHeader } from '@/components/SectionHeader';
import { MetricCard } from '@/components/MetricCard';
import { EngagementFunnel } from '@/components/EngagementFunnel';
import Chart from '@/components/ChartClient';
import { LiveActivityFeed, type ActivityEvent } from '@/components/LiveActivityFeed';

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

const btnGhost =
  'inline-flex items-center rounded-md border border-border-soft px-4 py-2.5 text-sm text-ink-2 transition-colors duration-200 hover:text-ink';

export default async function OemDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const activeRange = RANGES.includes(range ?? '') ? range! : '28d';

  const [dash, me] = await Promise.all([api.oemDashboard(), api.oemMe()]);
  if (dash.error?.status === 404) await redirectMissingOrg('oem');
  if (dash.error?.status === 403) redirect('/dashboard'); // wrong kind → advertiser side
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
  const revSeries = d.by_day.map((p) => ({ date: p.date, revenue: p.revenue_cents / 100 }));
  const revSpark = d.by_day.slice(-14).map((p) => p.revenue_cents);
  const impSpark = d.by_day.slice(-14).map((p) => p.impressions);
  const totalRev30 = d.by_day.reduce((s, p) => s + p.revenue_cents, 0);
  const fleetRevMax = Math.max(1, ...d.by_fleet.map((f) => f.revenue_30d_cents));

  const subtitle =
    d.total_fleets === 0
      ? 'Your first fleet is one click away.'
      : `${d.total_fleets} fleets · ${d.total_robots} robots · ${d.active_robots} active right now.`;

  const activity: ActivityEvent[] = d.recent_impressions.map((imp) => ({
    id: imp.id,
    time: formatRelative(imp.timestamp),
    type: 'impression',
    title: `Impression · ${imp.campaign_name}`,
    location: `${imp.fleet_name} · ${imp.robot_external_id}`,
    value_cents: imp.revenue_to_oem_cents,
  }));

  const has30 = d.impressions_30d > 0;

  return (
    <AppShell>
      <OnboardingTour role="oem" />
      <SectionHeader
        label="OVERVIEW · LAST 28 DAYS"
        greeting={`${greetingPrefix()}, ${name}.`}
        subtitle={subtitle}
        rangePills={RANGES}
        activePill={activeRange}
        rightActions={
          <Link href="/oem/fleets" className={btnGhost}>
            Manage fleets
          </Link>
        }
      />

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          label="PENDING PAYOUT"
          value={formatMoney(d.pending_payout_cents)}
          sparkline={has30 ? revSpark : undefined}
          sparklineColor="rust"
          context="paid out monthly"
        />
        <MetricCard
          label="LIFETIME EARNED"
          value={formatMoney(d.lifetime_payout_cents)}
          context="since signup"
        />
        <MetricCard
          label="ACTIVE ROBOTS"
          value={String(d.active_robots)}
          context={`of ${d.total_robots} total`}
        />
        <MetricCard
          label="IMPRESSIONS 24H"
          value={formatCount(d.impressions_24h)}
          sparkline={has30 ? impSpark : undefined}
          sparklineColor="navy"
          context={`across ${d.active_robots} robots`}
        />
        <MetricCard
          label="IMPRESSIONS 30D"
          value={formatCount(d.impressions_30d)}
          sparkline={has30 ? impSpark : undefined}
          sparklineColor="navy"
          context={`${d.total_fleets} fleets`}
        />
        <MetricCard
          label="REVENUE 30D"
          value={formatMoney(d.revenue_30d_cents)}
          sparkline={has30 ? revSpark : undefined}
          sparklineColor="rust"
          context="60% revenue share"
        />
      </div>

      {/* LiDAR audience — anonymous reach/attention your robots delivered */}
      <div className="mt-10">
        <div className="font-mono text-label uppercase tracking-wider text-ink-3">
          LiDAR audience · last 28 days
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-5">
          <MetricCard
            label="REACH"
            value={d.audience_30d.samples > 0 ? formatCount(d.audience_30d.avg_reach) : '—'}
            context={d.audience_30d.samples > 0 ? `peak ${formatCount(d.audience_30d.peak_reach)} in view` : 'no samples yet'}
          />
          <MetricCard
            label="ATTENTION"
            value={
              d.audience_30d.avg_reach > 0
                ? `${Math.round((d.audience_30d.avg_attended / d.audience_30d.avg_reach) * 100)}%`
                : '—'
            }
            context="faced the screen"
          />
          <MetricCard
            label="AVG DWELL"
            value={d.audience_30d.avg_dwell_s > 0 ? `${d.audience_30d.avg_dwell_s}s` : '—'}
            context="time in view"
          />
          <MetricCard
            label="NEAREST"
            value={d.audience_30d.nearest_m != null ? `${d.audience_30d.nearest_m}m` : '—'}
            context="closest approach"
          />
          <MetricCard
            label="AUDIENCE SAMPLES"
            value={formatCount(d.audience_30d.samples)}
            context="LiDAR ticks during ads"
          />
          <MetricCard
            label="PEOPLE NEARBY"
            value={d.audience_30d.avg_people_nearby != null ? formatCount(Math.round(d.audience_30d.avg_people_nearby)) : '—'}
            context={d.audience_30d.peak_people_nearby != null ? `peak ${formatCount(d.audience_30d.peak_people_nearby)} around robot` : 'lidar crowd'}
          />
          <MetricCard
            label="LOOK RATE"
            value={d.audience_30d.look_rate != null ? formatPct(d.audience_30d.look_rate) : '—'}
            context="looked / passed by"
          />
          <MetricCard
            label="PHONES OUT"
            value={d.audience_30d.total_phones_out ? formatCount(d.audience_30d.total_phones_out) : '—'}
            context="took phone out"
          />
          <MetricCard
            label="INTERACTIONS"
            value={d.audience_30d.total_interactions ? formatCount(d.audience_30d.total_interactions) : '—'}
            context="handshakes, waves, more"
          />
        </div>
        <div className="mt-6 rounded-lg border border-border-soft bg-card p-6">
          <EngagementFunnel summary={d.audience_30d} />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border-soft bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base text-ink">Earnings over time</h3>
            <span className="flex items-center gap-1.5 text-xs text-ink-3">
              <span className="h-1.5 w-1.5 rounded-full bg-rust" /> Revenue ($)
            </span>
          </div>
          <div className="mt-1 font-mono text-label uppercase text-ink-3">Daily revenue · 30 days</div>
          <div className="mt-4">
            {totalRev30 === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-ink-3">
                Earnings populate after your first impression.
              </div>
            ) : (
              <Chart
                data={revSeries}
                xKey="date"
                primaryKey="revenue"
                primaryLabel="Revenue"
                primaryFormat="usd"
              />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border-soft bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base text-ink">Performance by fleet</h3>
            <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
            </span>
          </div>
          <div className="mt-1 font-mono text-label uppercase text-ink-3">
            30-day impressions · revenue
          </div>
          {d.by_fleet.length === 0 ? (
            <p className="mt-6 text-sm text-ink-3">No fleets yet — create one to start earning.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {d.by_fleet.map((f) => (
                <li key={f.fleet_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink">{f.fleet_name}</span>
                    <span className="text-ink-2">
                      {formatMoney(f.revenue_30d_cents)} · {formatCount(f.impressions_30d)} imps
                      {f.avg_reach_30d > 0 ? ` · ${formatCount(f.avg_reach_30d)} reach` : ''}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-rust-soft">
                    <div
                      className="h-1 rounded-full bg-rust"
                      style={{ width: `${(f.revenue_30d_cents / fleetRevMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6">
        <LiveActivityFeed events={activity.slice(0, 10)} />
      </div>
    </AppShell>
  );
}
