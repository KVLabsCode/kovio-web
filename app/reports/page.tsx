import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { attentionRate, formatCount, formatPct } from '@/lib/format';
import type { Campaign } from '@/lib/types';
import { buildInsights, hourlyDistribution } from '@/lib/insights';
import AppShell from '@/components/AppShell';
import IntelligencePanel from '@/components/IntelligencePanel';
import ExportPdfButton from '@/components/ExportPdfButton';

function hourLabel(h: number): string {
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export default async function ReportsPage() {
  const [camps, dash] = await Promise.all([api.campaigns(), api.dashboard()]);

  if (dash.error?.status === 404) redirect('/onboarding');
  if (dash.error || !dash.data) {
    return (
      <AppShell page="Reports">
        <p className="text-sm text-danger">
          Couldn’t load reports: {dash.error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const d = dash.data;
  const campaigns: Campaign[] = camps.data?.campaigns ?? [];
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const generated = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const action = (
    <>
      <div className="hidden items-center gap-2 rounded-[10px] border border-line bg-panel px-3.5 py-2.5 text-[14px] text-ink sm:flex">
        All campaigns
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" className="stroke-faint" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <ExportPdfButton />
    </>
  );

  if (campaigns.length === 0) {
    return (
      <AppShell page="Reports" action={action}>
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">
          Hawkeye · full report · {monthLabel}
        </div>
        <h1 className="mt-2 font-serif text-[46px] font-medium leading-[1.04] tracking-[-0.02em] text-ink">
          Reports.
        </h1>
        <section className="mt-8 rounded-[18px] border border-dashed border-line-strong py-16 text-center">
          <div className="font-serif text-[30px] text-ink">No campaigns to report on yet</div>
          <p className="mx-auto mt-2 max-w-[440px] text-[16px] text-muted">
            Launch your first campaign and Kovio Intelligence will analyze its verified attention here.
          </p>
          <Link
            href="/campaigns/new"
            className="mt-6 inline-flex items-center rounded-[11px] bg-accent px-6 py-[14px] text-[16px] text-white transition-colors hover:bg-accent-dark"
          >
            + Create your first campaign
          </Link>
        </section>
      </AppShell>
    );
  }

  const insight = buildInsights(campaigns, d);
  const hours = hourlyDistribution(d);
  const maxHour = Math.max(...hours.map((h) => h.count), 1);
  const hasHourly = hours.some((h) => h.count > 0);
  const peak = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0]);

  // Category mix by impression share (always available).
  const totalImpr = campaigns.reduce((s, c) => s + (c.impressions_total ?? 0), 0) || 1;
  const byCategory = new Map<string, number>();
  for (const c of campaigns) {
    const k = c.category ?? 'general';
    byCategory.set(k, (byCategory.get(k) ?? 0) + (c.impressions_total ?? 0));
  }
  const categories = [...byCategory.entries()]
    .map(([name, impr]) => ({ name, share: impr / totalImpr }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 4);
  const catColors = ['bg-accent', 'bg-accent-soft', 'bg-tint-line', 'bg-tint'];

  // Attention funnel (real top two stages; engagement/scan not tracked yet).
  const passed = campaigns.reduce((s, c) => s + (c.walked_by_total ?? 0), 0);
  const looked = campaigns.reduce((s, c) => s + (c.attended_total ?? 0), 0);
  const lookedPct = passed > 0 ? looked / passed : null;

  // Top campaigns by reach.
  const topCampaigns = [...campaigns]
    .sort((a, b) => (b.impressions_total ?? 0) - (a.impressions_total ?? 0))
    .slice(0, 4);

  return (
    <AppShell page="Reports" action={action}>
      <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">
        Hawkeye · full report · {monthLabel}
      </div>
      <h1 className="mt-2 font-serif text-[46px] font-medium leading-[1.04] tracking-[-0.02em] text-ink">
        Reports.
      </h1>

      <IntelligencePanel insight={insight} generated={generated} />

      {/* dayparting + category mix */}
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[18px] border border-line bg-panel p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                Activity by hour
              </div>
              <div className="mt-1 font-serif text-[22px] text-ink">Dayparting</div>
            </div>
            <div className="text-[13px] text-muted">verified events / hr</div>
          </div>
          {hasHourly ? (
            <>
              <div className="mt-[22px] flex h-[180px] items-end gap-1.5">
                {hours.map((h) => {
                  const pct = Math.max(4, Math.round((h.count / maxHour) * 100));
                  const isPeak = h.count > 0 && h.count >= 0.7 * maxHour;
                  return (
                    <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <div
                        className={`w-full rounded-t-[4px] ${isPeak ? 'bg-accent' : 'bg-accent-soft'}`}
                        style={{ height: `${pct}%` }}
                      />
                      <div className="font-mono text-[9px] text-faint">{hourLabel(h.hour)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3.5 flex items-center gap-2 text-[13px] text-muted">
                <span className="h-3 w-3 rounded-[3px] bg-accent" />
                Peak window · {hourLabel(peak.hour)} is your busiest hour in the sample
              </div>
            </>
          ) : (
            <div className="mt-5 flex h-[180px] items-center justify-center rounded-[10px] border border-dashed border-line-strong text-[14px] text-faint">
              No recent hourly activity to chart yet.
            </div>
          )}
        </div>

        <div className="rounded-[18px] border border-line bg-panel p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
            Category mix · impression share
          </div>
          <div className="mt-5 flex flex-col gap-4">
            {categories.map((c, i) => (
              <div key={c.name}>
                <div className="mb-1.5 flex justify-between text-[14px]">
                  <span className="capitalize">{c.name}</span>
                  <span className="font-mono text-muted">{formatPct(c.share)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-[5px] bg-panel-2">
                  <div className={`h-full ${catColors[i % catColors.length]}`} style={{ width: `${Math.round(c.share * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-[22px] border-t border-dashed border-line pt-[18px] text-[14px] leading-[1.5] text-muted">
            {categories[0] && (
              <>
                <span className="font-semibold capitalize text-ink">{categories[0].name}</span> drives the
                largest share of your verified impressions.
              </>
            )}
          </div>
        </div>
      </div>

      {/* funnel + top campaigns */}
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_1.5fr]">
        <div className="rounded-[18px] border border-line bg-panel p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
            Attention funnel · 30d
          </div>
          <div className="mt-5 flex flex-col gap-3.5">
            <FunnelRow label="Passed by" value={formatCount(passed)} width={100} color="bg-accent" />
            <FunnelRow
              label="Looked"
              value={lookedPct != null ? `${formatCount(looked)} · ${formatPct(lookedPct)}` : formatCount(looked)}
              width={lookedPct != null ? Math.max(8, Math.round(lookedPct * 100)) : 8}
              color="bg-accent-soft"
            />
            <FunnelRow label="Engaged" value="—" width={0} color="bg-tint-line" muted />
            <FunnelRow label="Scanned / acted" value="—" width={0} color="bg-tint" muted />
          </div>
          <p className="mt-4 text-[12px] text-faint">
            Engagement &amp; scan tracking land here once conversion events are wired.
          </p>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-line bg-panel">
          <div className="px-6 pt-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">Top campaigns</div>
          </div>
          <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr] gap-3.5 px-6 pb-3 pt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            <span>Campaign</span>
            <span>Category</span>
            <span className="text-right">Impressions</span>
            <span className="text-right">Attention</span>
          </div>
          {topCampaigns.map((c) => {
            const r = attentionRate(c);
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="grid grid-cols-[1.8fr_1fr_1fr_1fr] items-center gap-3.5 border-t border-line px-6 py-3.5 transition-colors hover:bg-panel-2"
              >
                <span className="truncate font-serif text-[17px] text-ink">{c.name}</span>
                <span className="text-[14px] capitalize text-muted">{c.category ?? 'general'}</span>
                <span className="text-right font-mono text-[14px] text-ink">{formatCount(c.impressions_total ?? 0)}</span>
                <span className="text-right font-mono text-[14px] text-good">{r != null ? formatPct(r) : '—'}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function FunnelRow({
  label,
  value,
  width,
  color,
  muted,
}: {
  label: string;
  value: string;
  width: number;
  color: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[14px]">
        <span className={muted ? 'text-faint' : ''}>{label}</span>
        <span className="font-mono text-muted">{value}</span>
      </div>
      <div className="h-7 overflow-hidden rounded-[7px] bg-panel-2">
        <div className={`h-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
