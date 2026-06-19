import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import { MetricCard } from '@/components/MetricCard';
import Chart from '@/components/ChartClient';
import PauseResumeButton from '@/components/PauseResumeButton';
import type { Campaign } from '@/lib/types';

function formatTargeting(rules: Campaign['targeting']): string {
  if (!rules || rules.length === 0) return 'No targeting rules — shows everywhere.';
  const parts: string[] = [];
  for (const r of rules) {
    const field = r.field as string;
    const value = r.value as unknown;
    if (field === 'hour_of_day' && Array.isArray(value)) {
      const [a, b] = value as number[];
      parts.push(`Between ${a}:00 and ${b}:00`);
    } else if (field === 'person_count') {
      parts.push(`At least ${String(value)} person watching`);
    } else {
      parts.push(`${field} ${String(r.op)} ${JSON.stringify(value)}`);
    }
  }
  return parts.join(', ');
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, error } = await api.campaign(id);
  if (error?.status === 404) notFound();
  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">
          Couldn’t load campaign: {error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const { campaign: c, stats } = data;
  const launched = new Date(c.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const series = stats.by_day.map((d) => ({ date: d.date, spend: d.spent_cents / 100 }));

  return (
    <AppShell>
      <SectionHeader
        label={`CAMPAIGN · ${c.status.toUpperCase()}`}
        greeting={c.name}
        subtitle={`${c.advertiser} · ${c.category ?? 'uncategorized'} · launched ${launched}`}
        rightActions={<PauseResumeButton id={c.id} status={c.status} />}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <MetricCard label="IMPRESSIONS" value={String(stats.impressions_total)} />
        <MetricCard label="SPENT" value={formatMoney(stats.spent_cents_total)} />
        <MetricCard label="REMAINING" value={formatMoney(stats.remaining_cents)} />
      </div>

      {/* LiDAR audience this ad reached while playing (anonymous) */}
      <div className="mt-6">
        <div className="font-mono text-label uppercase tracking-wider text-ink-3">
          LiDAR audience · last 28 days
        </div>
        <div className="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <MetricCard
            label="REACH"
            value={stats.audience_30d.samples > 0 ? String(stats.audience_30d.avg_reach) : '—'}
            context={stats.audience_30d.samples > 0 ? `peak ${stats.audience_30d.peak_reach} in view` : 'no samples yet'}
          />
          <MetricCard
            label="ATTENTION"
            value={
              stats.audience_30d.avg_reach > 0
                ? `${Math.round((stats.audience_30d.avg_attended / stats.audience_30d.avg_reach) * 100)}%`
                : '—'
            }
            context="faced the screen"
          />
          <MetricCard
            label="AVG DWELL"
            value={stats.audience_30d.samples > 0 ? `${stats.audience_30d.avg_dwell_s}s` : '—'}
            context="time in view"
          />
          <MetricCard
            label="NEAREST"
            value={stats.audience_30d.nearest_m != null ? `${stats.audience_30d.nearest_m}m` : '—'}
            context="closest viewer"
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border-soft bg-card p-6">
        <h3 className="text-base text-ink">Daily spend</h3>
        <div className="mt-1 font-mono text-label uppercase text-ink-3">Last 30 days</div>
        <div className="mt-4">
          <Chart
            data={series}
            xKey="date"
            primaryKey="spend"
            primaryLabel="Spend"
            primaryFormat="usd"
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border-soft bg-card p-6">
        <h3 className="text-base text-ink">Details</h3>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Detail label="Creative">
            <div className="flex items-center gap-3">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded border border-border-soft bg-black/5">
                {c.creative_type === 'video' ? (
                  <video
                    src={c.creative_url}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : c.creative_type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.creative_url} alt="creative" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase text-ink-3">
                    html
                  </div>
                )}
              </div>
              <div>
                <span className="rounded bg-rust-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rust-dark">
                  {c.creative_type}
                </span>
                <a
                  href={c.creative_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-rust transition-colors hover:text-rust-dark"
                >
                  Open creative →
                </a>
              </div>
            </div>
          </Detail>
          <Detail label="Targeting">{formatTargeting(c.targeting)}</Detail>
          <Detail label="Encounter cap">{c.encounter_cap_seconds}s</Detail>
          <Detail label="Cost / impression">{formatMoney(c.cost_per_impression_cents)}</Detail>
          <Detail label="Cost / attended">{formatMoney(c.cost_per_attended_cents)}</Detail>
          <Detail label="Budget">{formatMoney(c.budget_total_cents)}</Detail>
          <Detail label="Start">{new Date(c.start_at).toLocaleDateString()}</Detail>
          <Detail label="End">{c.end_at ? new Date(c.end_at).toLocaleDateString() : '—'}</Detail>
        </dl>
      </div>
    </AppShell>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-dashed border-border-soft py-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className="ml-4 text-right text-ink">{children}</dd>
    </div>
  );
}
