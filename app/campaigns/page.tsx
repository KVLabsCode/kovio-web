import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatMoney, formatCount, formatPct, attentionRate } from '@/lib/format';
import AppShell from '@/components/AppShell';

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const { data, error } = await api.campaigns();
  if (error?.status === 404) redirect('/onboarding');
  if (error || !data) {
    return (
      <AppShell page="Campaigns">
        <p className="text-sm text-danger">
          Couldn’t load campaigns: {error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const q = (rawQ ?? '').trim();
  const all = data.campaigns;
  const campaigns = q ? all.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : all;

  return (
    <AppShell page="Campaigns">
      <div className="flex items-end justify-between mb-[34px]">
        <div>
          <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-faint">
            CAMPAIGNS
          </p>
          <h1 className="font-serif font-medium text-[54px] leading-none tracking-[-0.015em] text-ink my-[14px] mb-2">
            Campaigns.
          </h1>
          <p className="text-[19px] text-muted">
            {q ? (
              <>
                Results for <span className="text-ink">“{q}”</span> ·{' '}
                <Link href="/campaigns" className="text-accent-dark hover:text-accent">clear</Link>
              </>
            ) : (
              'Manage your active and past campaigns.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns/placements"
            className="inline-flex items-center rounded-[11px] border border-line-strong px-5 py-[14px] text-[16px] text-ink transition-colors hover:border-accent"
          >
            Placements
          </Link>
          <Link
            href="/campaigns/place"
            className="inline-flex items-center rounded-[11px] bg-accent px-6 py-[14px] text-[16px] text-white transition-colors hover:bg-accent-dark"
          >
            + New campaign
          </Link>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="border border-dashed border-line-strong rounded-[18px] py-16 text-center">
          <p className="font-serif text-[32px] text-ink">No campaigns yet</p>
          <p className="text-[18px] text-muted mt-2">
            Your first campaign takes about two minutes.
          </p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center rounded-[11px] bg-accent px-6 py-[14px] text-[16px] text-white transition-colors hover:bg-accent-dark mt-6"
          >
            + New campaign
          </Link>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-line-strong py-16 text-center">
          <p className="font-serif text-[28px] text-ink">No campaigns match “{q}”.</p>
          <Link href="/campaigns" className="mt-4 inline-block text-[16px] text-accent-dark hover:text-accent">
            Clear search
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center gap-[30px] bg-panel border border-line rounded-[16px] px-7 py-6 transition-colors hover:bg-panel-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-serif text-[26px] text-ink">{c.name}</span>
                  <span className="font-mono text-[11px] uppercase text-accent-dark bg-tint px-[9px] py-1 rounded-[20px]">
                    {c.status}
                  </span>
                </div>
                <p className="text-[14px] text-muted mt-1">
                  {c.category ?? 'general'} · launched{' '}
                  {new Date(c.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="text-right">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                  IMPRESSIONS
                </p>
                <p className="text-[22px] font-semibold text-ink mt-1">
                  {formatCount(c.impressions_total ?? 0)}
                </p>
              </div>

              <div className="text-right">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                  SPENT
                </p>
                <p className="text-[22px] font-semibold text-ink mt-1">
                  {formatMoney(c.budget_spent_cents)}
                </p>
              </div>

              <div className="text-right">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                  ATTENTION
                </p>
                <p className="text-[22px] font-semibold text-ink mt-1">
                  {(() => {
                    const r = attentionRate(c);
                    return r != null ? formatPct(r) : '—';
                  })()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
