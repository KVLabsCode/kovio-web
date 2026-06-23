import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCount, formatMoney, formatPct, attentionRate } from '@/lib/format';
import type { Campaign } from '@/lib/types';
import AppShell from '@/components/AppShell';
import HawkeyeTile from '@/components/HawkeyeTile';
import CampaignPicker from '@/components/CampaignPicker';

// A short, stable unit label per campaign (deterministic from its id) so the
// live tile reads like a real fleet unit.
function unitFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 900;
  return `unit-${String(100 + h).slice(0, 3)}`;
}

export default async function HawkeyePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign: campaignId } = await searchParams;
  const { data, error } = await api.campaigns();

  if (error?.status === 404) redirect('/onboarding');
  if (error || !data) {
    return (
      <AppShell page="Hawkeye">
        <p className="text-sm text-danger">Couldn’t load Hawkeye: {error?.detail ?? 'unknown error'}</p>
      </AppShell>
    );
  }

  const campaigns: Campaign[] = data.campaigns;

  if (campaigns.length === 0) {
    return (
      <AppShell page="Hawkeye">
        <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">Hawkeye · live</div>
        <h1 className="mt-2 font-serif text-[46px] font-medium leading-[1.04] tracking-[-0.02em] text-ink">
          Hawkeye.
        </h1>
        <section className="mt-8 rounded-[18px] border border-dashed border-line-strong py-16 text-center">
          <div className="font-serif text-[30px] text-ink">Nothing live yet</div>
          <p className="mx-auto mt-2 max-w-[440px] text-[16px] text-muted">
            Launch a campaign to watch your ad run on robots in real time, with verified attention.
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

  const active = campaigns.filter((c) => c.status === 'active');
  const selectedId =
    campaignId && campaigns.some((c) => c.id === campaignId)
      ? campaignId
      : active[0]?.id ?? campaigns[0].id;
  const selected = campaigns.find((c) => c.id === selectedId)!;
  const rate = attentionRate(selected);
  const isLive = selected.status === 'active';

  const action = (
    <CampaignPicker
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
      value={selectedId}
      allowAll={false}
    />
  );

  return (
    <AppShell page="Hawkeye" action={action}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">Hawkeye · live</div>
          <h1 className="mt-2 font-serif text-[46px] font-medium leading-[1.04] tracking-[-0.02em] text-ink">
            Hawkeye.
          </h1>
        </div>
        <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-good">
          <span className="k-pulse h-1.5 w-1.5 rounded-full bg-good" />
          {active.length} campaign{active.length === 1 ? '' : 's'} live now
        </div>
      </div>

      {/* live now — quick switch between active campaigns */}
      {active.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {active.map((c) => {
            const on = c.id === selectedId;
            return (
              <Link
                key={c.id}
                href={`/hawkeye?campaign=${c.id}`}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] transition-colors ${
                  on ? 'border-accent bg-tint text-accent-dark' : 'border-line bg-panel text-muted hover:text-ink'
                }`}
              >
                <span className="k-pulse h-1.5 w-1.5 rounded-full bg-good" />
                {c.name}
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.62fr_1fr]">
        <HawkeyeTile
          unit={unitFor(selected.id)}
          location={`${selected.name} · citywide fleet`}
          passed={selected.walked_by_total ?? 0}
          looked={selected.attended_total ?? 0}
          engaged={0}
          fps={30}
        />

        {/* selected campaign summary */}
        <div className="flex flex-col rounded-[18px] border border-line bg-panel p-6">
          <div className="flex items-center justify-between">
            <div className="font-serif text-[22px] text-ink">{selected.name}</div>
            <span
              className={`rounded-[20px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${
                isLive ? 'bg-panel-2 text-good' : 'bg-tint text-accent-dark'
              }`}
            >
              {selected.status}
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {isLive ? 'Streaming verified events' : 'Not currently live'}
          </div>

          <div className="mt-6 flex flex-col gap-[18px]">
            <Stat label="Impressions" value={formatCount(selected.impressions_total ?? 0)} />
            <Stat label="Attention rate" value={rate != null ? formatPct(rate) : '—'} tone="good" />
            <Stat label="Spent" value={formatMoney(selected.budget_spent_cents)} />
            <Stat label="Passed by" value={formatCount(selected.walked_by_total ?? 0)} />
            <Stat label="Looked" value={formatCount(selected.attended_total ?? 0)} />
          </div>

          <div className="mt-auto pt-6">
            <Link
              href={`/campaigns/${selected.id}`}
              className="inline-flex items-center text-[15px] text-accent-dark hover:text-accent"
            >
              Open campaign detail →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] text-muted">{label}</span>
      <span className={`font-mono text-[15px] ${tone === 'good' ? 'text-good' : 'text-ink'}`}>{value}</span>
    </div>
  );
}
