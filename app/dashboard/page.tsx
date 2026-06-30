import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCount, formatMoney, formatPct, attentionRate } from '@/lib/format';
import { EngagementFunnel } from '@/components/EngagementFunnel';
import type { Campaign, RecentImpression } from '@/lib/types';
import AppShell from '@/components/AppShell';
import RangePills from '@/components/RangePills';
import LiveActivityHero from '@/components/LiveActivityHero';
import FleetCountdown from '@/components/FleetCountdown';
import { FLEET_GO_LIVE, goLiveDateLabel } from '@/lib/fleet-clips';

const RANGES = ['24H', '7D', '30D', 'ALL'];

const GETTING_STARTED = [
  {
    n: '1',
    title: 'Create your first campaign',
    desc: 'Pick a name, drop a creative, launch in two minutes.',
    link: 'Create campaign →',
  },
  {
    n: '2',
    title: 'Watch Hawkeye',
    desc: 'See live footage of robots running your ad, with verified attention.',
    link: 'See it live →',
  },
  {
    n: '3',
    title: 'Go paid when ready',
    desc: 'Set your own budget per campaign after the free trial. Pay only for what runs.',
    link: 'Learn more →',
  },
];

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function dateLabel(d: Date): string {
  const wd = d.toLocaleDateString('en-US', { weekday: 'long' });
  const rest = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${wd} · ${rest}`;
}

const newCampaignBtn = (
  <Link
    href="/campaigns/new"
    className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-[18px] py-2.5 text-[14px] text-white transition-colors hover:bg-accent-dark"
  >
    + New campaign
  </Link>
);

// Build a real daily impressions+spend series from recent verified events.
function buildSeries(recent: RecentImpression[]) {
  const byDay = new Map<string, { impr: number; spend: number }>();
  for (const r of recent) {
    const t = new Date(r.timestamp);
    if (Number.isNaN(t.getTime())) continue;
    const key = t.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { impr: 0, spend: 0 };
    cur.impr += 1;
    cur.spend += r.cost_cents;
    byDay.set(key, cur);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, v]) => ({ date, ...v }));
}

function KpiCard({
  label,
  value,
  sub,
  subTone = 'muted',
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  subTone?: 'good' | 'muted';
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-[16px] border p-5 ${
        highlight ? 'border-tint-line bg-tint' : 'border-line bg-panel'
      }`}
    >
      <div
        className={`font-mono text-[11px] uppercase tracking-[0.1em] ${
          highlight ? 'text-accent-dark' : 'text-faint'
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-3 font-mono text-[34px] leading-none tracking-[-0.01em] ${
          highlight ? 'text-accent-dark' : 'text-ink'
        }`}
      >
        {value}
      </div>
      {sub != null && (
        <div className={`mt-2.5 text-[13px] ${subTone === 'good' ? 'text-good' : 'text-muted'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function PerformanceChart({ series }: { series: ReturnType<typeof buildSeries> }) {
  if (series.length < 2) {
    return (
      <div className="flex h-[230px] items-center justify-center rounded-[10px] border border-dashed border-line-strong text-[14px] text-faint">
        Not enough recent activity to chart yet.
      </div>
    );
  }
  const W = 637;
  const H = 200;
  const n = series.length;
  const maxImpr = Math.max(...series.map((d) => d.impr), 1);
  const maxSpend = Math.max(...series.map((d) => d.spend), 1);
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yi = (v: number) => H - (v / maxImpr) * (H - 24);
  const ys = (v: number) => H - (v / maxSpend) * (H - 24);
  const imprLine = series.map((d, i) => `${x(i).toFixed(1)},${yi(d.impr).toFixed(1)}`).join(' ');
  const imprArea = `0,${H} ${imprLine} ${W},${H}`;
  const spendLine = series.map((d, i) => `${x(i).toFixed(1)},${ys(d.spend).toFixed(1)}`).join(' ');
  const fmtDay = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="relative mt-5">
      <svg viewBox={`0 0 ${W} ${H + 4}`} width="100%" height="230" preserveAspectRatio="none">
        {[44, 88, 132, 176].map((y) => (
          <line key={y} x1="0" y1={y} x2={W} y2={y} className="stroke-line" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        ))}
        <polygon points={imprArea} className="fill-accent" fillOpacity="0.14" />
        <polyline points={imprLine} fill="none" className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={spendLine} fill="none" className="stroke-navy" strokeWidth="1.8" strokeDasharray="5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-faint">
        <span>{fmtDay(series[0].date)}</span>
        <span>{fmtDay(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range = RANGES.includes(rawRange ?? '') ? (rawRange as string) : '30D';

  const [dash, camps, me] = await Promise.all([api.dashboard(), api.campaigns(), api.me()]);

  if (dash.error?.status === 404) redirect('/onboarding');
  if (dash.error || !dash.data) {
    return (
      <AppShell page="Overview">
        <p className="text-sm text-danger">
          Couldn’t load your dashboard: {dash.error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const d = dash.data;
  const campaigns: Campaign[] = camps.data?.campaigns ?? [];
  const brand = me.data?.org.name ?? 'there';
  const now = new Date();

  // ---- Trial / empty state (API-driven, kept) ----
  if (campaigns.length === 0) {
    return (
      <AppShell page="Overview" action={newCampaignBtn}>
        <LiveActivityHero />
        <div className="mt-7 font-mono text-[12px] uppercase tracking-[0.16em] text-faint">
          {dateLabel(now)}
        </div>
        <h1 className="mt-2 font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.02em] text-ink sm:text-[38px] lg:text-[44px]">
          {greeting(now)}, <em className="italic text-accent-dark">{brand}.</em>
        </h1>
        <p className="mt-3 max-w-[640px] text-[18px] leading-[1.5] text-muted">
          Your free trial covers{' '}
          <span className="text-ink">one full campaign</span>{' '}
          on a live citywide robot fleet. No card needed, let&apos;s get it running.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-7 lg:grid-cols-[1.7fr_1fr]">
          {/* Getting started */}
          <section className="rounded-[18px] border border-line bg-panel px-5 py-5 sm:px-8 sm:py-6">
            <div className="mb-5 font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
              Getting started
            </div>
            {GETTING_STARTED.map((step, i) => (
              <div key={step.n} className={`flex gap-[18px] ${i < GETTING_STARTED.length - 1 ? 'mb-5' : ''}`}>
                <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-tint font-mono text-[14px] text-accent-dark">
                  {step.n}
                </div>
                <div>
                  <div className="text-[17px] font-semibold text-ink sm:text-[18px]">{step.title}</div>
                  <div className="mt-0.5 text-[15px] leading-[1.4] text-muted sm:text-[16px]">{step.desc}</div>
                  <Link href="/campaigns/new" className="mt-1 inline-block text-[15px] text-accent-dark hover:text-accent sm:text-[16px]">
                    {step.link}
                  </Link>
                </div>
              </div>
            ))}
          </section>

          {/* Plan card */}
          <section className="flex flex-col rounded-[18px] border border-tint-line bg-tint px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-start justify-between">
              <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-accent-dark">Your plan</div>
              <span className="rounded-[20px] bg-panel px-2.5 py-1 font-mono text-[11px] text-accent-dark">FREE TRIAL</span>
            </div>
            <div className="mt-4 font-serif text-[32px] leading-[1.04] text-ink sm:text-[40px]">
              Your first campaign, free
            </div>
            <p className="mb-auto mt-3 text-[15px] text-muted">
              Launch the default citywide setup. No card needed until you go paid.
            </p>
            <Link
              href="/campaigns/new"
              className="mt-6 inline-flex w-full items-center justify-center rounded-[11px] bg-accent py-[14px] text-[16px] text-white transition-colors hover:bg-accent-dark"
            >
              + Launch free campaign
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  // ---- Active overview ----
  const impressions = range === '24H' ? d.impressions_24h : d.impressions_30d;
  const spendCents = range === '24H' ? d.spent_24h_cents : d.spent_30d_cents;
  const budgetTotal = campaigns.reduce((s, c) => s + (c.budget_total_cents ?? 0), 0);
  const walked = campaigns.reduce((s, c) => s + (c.walked_by_total ?? 0), 0);
  const attended = campaigns.reduce((s, c) => s + (c.attended_total ?? 0), 0);
  const attRate = attentionRate({ walked_by_total: walked, attended_total: attended });
  const series = buildSeries(d.recent_impressions);
  const dwell = d.audience_30d.avg_dwell_s;
  const nearest = d.audience_30d.nearest_m;

  // Range caption: what window the dashboard is showing + when the campaign(s)
  // began, so a brand new to the page knows the data is "since launch", not empty.
  const RANGE_WINDOW: Record<string, string> = {
    '24H': 'last 24 hours',
    '7D': 'last 7 days',
    '30D': 'last 30 days',
    ALL: 'all time',
  };
  const startTimes = campaigns
    .map((c) => new Date(c.start_at).getTime())
    .filter((t) => !Number.isNaN(t));
  const earliestStart = startTimes.length ? new Date(Math.min(...startTimes)) : null;
  const fmtDate = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const daysRunning = earliestStart
    ? Math.max(0, Math.floor((now.getTime() - earliestStart.getTime()) / 86_400_000))
    : null;
  let startMeta: string | null = null;
  if (earliestStart) {
    if (earliestStart.getTime() > now.getTime()) {
      startMeta = `Starts ${fmtDate(earliestStart)}`;
    } else {
      const span =
        daysRunning === 0 ? 'first day of data' : `${daysRunning} day${daysRunning === 1 ? '' : 's'} of data`;
      startMeta = `Live since ${fmtDate(earliestStart)} · ${span}`;
    }
  }

  return (
    <AppShell page="Overview" action={newCampaignBtn}>
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">
            {dateLabel(now)}
          </div>
          <h1 className="mt-2 font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.02em] text-ink sm:text-[38px] lg:text-[44px]">
            {greeting(now)}, <em className="italic text-accent-dark">{brand}.</em>
          </h1>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <RangePills pills={RANGES} active={range} />
          <div className="font-mono text-[11px] text-faint">
            Showing {RANGE_WINDOW[range] ?? RANGE_WINDOW['30D']}
            {startMeta && <> · {startMeta}</>}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-[26px] grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Impressions"
          value={formatCount(impressions)}
          sub={<>verified by sensor · {range === '24H' ? 'last 24h' : 'last 30d'}</>}
        />
        <KpiCard
          label="Verified attention"
          value={attRate != null ? formatPct(attRate) : '—'}
          sub="faced the screen / passed by"
        />
        <KpiCard
          label={`Spend · ${range === '24H' ? '24h' : '30d'}`}
          value={formatMoney(spendCents)}
          sub={budgetTotal > 0 ? <>of <span className="text-ink">{formatMoney(budgetTotal)}</span> budget</> : undefined}
        />
        <KpiCard
          label="GMV attributed"
          value="—"
          sub="conversion tracking coming soon"
          highlight
        />
      </div>

      {/* chart + live activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.62fr_1fr]">
        <div className="rounded-[18px] border border-line bg-panel p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                Performance · recent
              </div>
              <div className="mt-1 font-serif text-[24px] text-ink">Impressions &amp; spend</div>
            </div>
            <div className="flex gap-4 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[3px] w-[14px] rounded-sm bg-accent" />Impressions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-[14px] border-t-2 border-dashed border-navy" />Spend
              </span>
            </div>
          </div>
          <PerformanceChart series={series} />
        </div>

        <div className="flex flex-col rounded-[18px] border border-line bg-panel p-6">
          <div className="flex items-center justify-between">
            <div className="font-serif text-[20px] text-ink">Live activity</div>
            {d.recent_impressions.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent-dark">
                <span className="k-pulse h-1.5 w-1.5 rounded-full bg-accent" />Standby
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-good">
                <span className="k-pulse h-1.5 w-1.5 rounded-full bg-good" />Streaming
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            Verified events · live
          </div>
          <div className="mt-3.5 flex flex-1 flex-col">
            {d.recent_impressions.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-tint px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-accent-dark">
                  <span className="k-pulse h-1.5 w-1.5 rounded-full bg-accent" />
                  Going live {goLiveDateLabel(FLEET_GO_LIVE)}
                </span>
                <FleetCountdown className="text-[15px] text-ink" />
                <p className="max-w-[250px] text-[13px] leading-[1.45] text-faint">
                  Verified events stream here the moment your campaign hits the live fleet.
                </p>
              </div>
            ) : (
              d.recent_impressions.slice(0, 6).map((ev, i) => {
                const t = new Date(ev.timestamp);
                const time = Number.isNaN(t.getTime())
                  ? '—'
                  : t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                return (
                  <div key={i} className="flex items-start gap-3 border-b border-dashed border-line py-[11px]">
                    <span className="w-[38px] flex-none pt-px font-mono text-[12px] text-faint">{time}</span>
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-ink">Verified impression</span>
                      <span className="block truncate text-[12px] text-faint">{ev.campaign_name}</span>
                    </span>
                    <span className="flex-none font-mono text-[13px] text-good">
                      +{formatMoney(ev.cost_cents)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Audience */}
      <div className="mt-4 rounded-[18px] border border-line bg-panel p-6">
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-[20px] text-ink">Audience</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            LiDAR telemetry · 30d
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          <AudienceMetric label="Avg reach in view" value={d.audience_30d.samples > 0 ? formatCount(Math.round(d.audience_30d.avg_reach)) : '—'} />
          <AudienceMetric label="Peak reach" value={d.audience_30d.samples > 0 ? formatCount(d.audience_30d.peak_reach) : '—'} />
          <AudienceMetric label="Audience samples" value={formatCount(d.audience_30d.samples)} />
          <AudienceMetric label="Avg dwell on look" value={dwell > 0 ? `${dwell}s` : '—'} />
          <AudienceMetric label="Nearest approach" value={nearest != null ? `${nearest}m` : '—'} />
          <AudienceMetric label="People nearby" value={d.audience_30d.avg_people_nearby != null ? formatCount(Math.round(d.audience_30d.avg_people_nearby)) : '—'} />
          <AudienceMetric label="Look rate" value={d.audience_30d.look_rate != null ? formatPct(d.audience_30d.look_rate) : '—'} />
          <AudienceMetric label="Phones out" value={d.audience_30d.total_phones_out ? formatCount(d.audience_30d.total_phones_out) : '—'} />
          <AudienceMetric label="Interactions" value={d.audience_30d.total_interactions ? formatCount(d.audience_30d.total_interactions) : '—'} />
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <EngagementFunnel summary={d.audience_30d} />
        </div>
      </div>

      {/* campaigns table */}
      <div className="mt-8">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-faint">Your campaigns</div>
          <Link href="/campaigns" className="text-[14px] text-accent-dark hover:text-accent">View all →</Link>
        </div>
        <div className="overflow-x-auto rounded-[16px] border border-line bg-panel">
          <div className="min-w-[680px]">
          <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_0.9fr] gap-[18px] border-b border-line px-6 py-3.5 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            <span>Campaign</span>
            <span>Category</span>
            <span className="text-right">Impressions</span>
            <span className="text-right">Spent</span>
            <span className="text-right">Attention</span>
          </div>
          {campaigns.map((c) => {
            const r = attentionRate(c);
            const active = c.status === 'active';
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="grid grid-cols-[2.4fr_1fr_1fr_1fr_0.9fr] items-center gap-[18px] border-b border-line px-6 py-[18px] text-ink transition-colors last:border-0 hover:bg-panel-2"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="truncate font-serif text-[19px]">{c.name}</span>
                  <span
                    className={`flex-none rounded-[20px] px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.06em] ${
                      active ? 'bg-panel-2 text-good' : 'bg-tint text-accent-dark'
                    }`}
                  >
                    {c.status}
                  </span>
                </span>
                <span className="text-[14px] text-muted">{c.category ?? 'general'}</span>
                <span className="text-right font-mono text-[15px]">{formatCount(c.impressions_total ?? 0)}</span>
                <span className="text-right font-mono text-[15px]">{formatMoney(c.budget_spent_cents)}</span>
                <span className="text-right font-mono text-[15px] text-good">{r != null ? formatPct(r) : '—'}</span>
              </Link>
            );
          })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function AudienceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="mt-1.5 font-serif text-[28px] text-ink">{value}</div>
    </div>
  );
}
