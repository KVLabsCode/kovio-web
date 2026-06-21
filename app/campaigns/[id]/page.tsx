import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { formatMoney, formatCount, formatPct, attentionRate as computeAttentionRate } from '@/lib/format';
import AppShell from '@/components/AppShell';
import HawkeyeTile, { CampaignPauseButton } from '@/components/HawkeyeTile';
import HawkeyeFeed from '@/components/HawkeyeFeed';

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
        <p className="text-[15px] text-danger">
          Couldn’t load campaign: {error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const { campaign: c, stats } = data;

  // --- metric derivations -------------------------------------------------
  const impressions = stats.impressions_total;
  const attended = stats.attended_total;
  const walkedBy = stats.walked_by_total;
  const engaged = 0;

  // Same derivation as the list/dashboard (lib/format) so the number can't drift.
  const attentionRate = computeAttentionRate(stats) ?? 0;

  const cpm =
    impressions > 0
      ? formatMoney(Math.round((stats.spent_cents_total / impressions) * 1000))
      : '—';

  const metrics: { label: string; value: string; title?: string }[] = [
    { label: 'IMPRESSIONS', value: formatCount(impressions), title: 'Total impressions served' },
    { label: 'ATTENDED', value: formatCount(attended), title: 'People who faced the screen' },
    { label: 'ATTENTION RATE', value: formatPct(attentionRate), title: 'Attended / passed by' },
    { label: 'ENGAGED', value: formatCount(engaged), title: 'Interactions (QR / touch)' },
    { label: 'SPENT', value: formatMoney(stats.spent_cents_total), title: 'Budget spent so far' },
    { label: 'CPM', value: cpm, title: 'Cost per thousand impressions' },
  ];

  return (
    <AppShell>
      {/* Header */}
      <header className="flex items-start justify-between mb-[26px]">
        <div>
          <div className="font-mono text-[13px] uppercase tracking-[0.14em] text-faint">
            CAMPAIGN · {c.status.toUpperCase()}
          </div>
          <h1 className="font-serif font-medium text-[62px] leading-none tracking-[-0.01em] text-ink my-[14px] mb-2.5">
            {c.name}
          </h1>
          <div className="text-[17px] text-muted">
            {c.category ?? 'general'} · {formatMoney(c.budget_total_cents)} budget
          </div>
        </div>
        <CampaignPauseButton id={c.id} status={c.status} />
      </header>

      {/* Metric cards */}
      <div className="grid grid-cols-6 gap-4 mb-[46px]">
        {metrics.map((m) => (
          <div
            key={m.label}
            title={m.title}
            className="bg-panel border border-line rounded-[14px] p-[22px]"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
              {m.label}
            </div>
            <div className="text-[40px] font-bold tracking-[-0.02em] text-ink mt-2">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Hawkeye sub-header */}
      <div className="flex items-end justify-between mb-[22px]">
        <div>
          <h2 className="font-serif font-medium text-[36px] text-ink">Hawkeye</h2>
          <p className="text-[17px] text-muted">
            Live footage of robots running this campaign, with verified interaction data.
          </p>
        </div>
        <Link
          href={`/campaigns/${c.id}/report`}
          className="rounded-[11px] border border-accent px-5 py-3 text-accent transition-colors hover:bg-tint"
        >
          Hawkeye full report →
        </Link>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-[1.35fr_1fr] gap-6">
        {/* Left: animated tile */}
        <HawkeyeTile
          unit="Unitree G1-001"
          location="Market St & 3rd, SF"
          passed={walkedBy}
          looked={attended}
          engaged={0}
          fps={30}
        />

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Engagement breakdown */}
          <div className="bg-panel border border-line rounded-[16px] px-[30px] py-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint mb-[22px]">
              ENGAGEMENT BREAKDOWN
            </div>
            <div className="h-3 rounded-[6px] overflow-hidden flex mb-[26px]">
              <div className="bg-navy" style={{ width: '94%' }} />
              <div className="bg-accent" style={{ width: '5%' }} />
              <div className="bg-good" style={{ width: '1%' }} />
            </div>
            <LegendRow color="bg-navy" label="Views" pct="94%" />
            <LegendRow color="bg-accent" label="QR scans" pct="5%" />
            <LegendRow color="bg-good" label="Touches" pct="1%" last />
          </div>

          {/* Live activity */}
          <HawkeyeFeed />
        </div>
      </div>
    </AppShell>
  );
}

function LegendRow({
  color,
  label,
  pct,
  last,
}: {
  color: string;
  label: string;
  pct: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-3.5 ${
        last ? '' : 'border-b border-line'
      }`}
    >
      <div className="flex items-center">
        <span className={`block rounded-full ${color}`} style={{ width: 9, height: 9 }} />
        <span className="text-[16px] text-ink ml-2.5">{label}</span>
      </div>
      <span className="text-[16px] text-ink">{pct}</span>
    </div>
  );
}
