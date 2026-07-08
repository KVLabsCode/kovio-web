import Link from 'next/link';
import { fullMetrics, compact, type ShowcaseCampaign } from '@/lib/showcase';

// Campaigns Kovio ran for this advertiser (showcase campaigns) rendered as
// completed FREE-TRIAL campaigns on their Campaigns page — full metrics, no
// pricing or invoices anywhere.
export default function FreeTrialCampaigns({ campaigns }: { campaigns: ShowcaseCampaign[] }) {
  if (campaigns.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className="font-serif text-[26px] font-medium tracking-[-0.01em] text-ink">Completed campaigns</h2>
        <span className="rounded-full bg-tint px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-dark">
          Free trial
        </span>
      </div>
      <p className="mb-4 max-w-2xl text-[14px] text-muted">
        Kovio ran these on the robot fleet on us — no charge, real streets.{' '}
        <Link href="/dashboard" className="text-accent-dark hover:text-accent">See the full report →</Link>
      </p>

      <div className="grid gap-4">
        {campaigns.map((c, i) => {
          const m = fullMetrics(c);
          const lookPct = Math.round((m.attention_rate ?? 0) * 100);
          return (
            <div key={c.id ?? i} className="rounded-[16px] border border-line bg-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[17px] font-medium text-ink">{c.name}</div>
                  <div className="mt-0.5 text-[14px] text-muted">
                    Robot fleet
                    {c.location_label ? ` · ${c.location_label}` : ''}
                    {c.duration_label ? ` · ${c.duration_label}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-good/10 px-2.5 py-1 text-xs text-good">Completed</span>
                  <span className="rounded-full bg-tint px-2.5 py-1 text-xs text-accent-dark">Free trial</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
                {[
                  { label: 'Impressions', v: compact(m.impressions) },
                  { label: 'Verified looks', v: compact(m.attended) },
                  { label: 'Attention rate', v: `${lookPct}%` },
                  { label: 'Avg dwell', v: `${m.avg_dwell_s}s` },
                ].map((t) => (
                  <div key={t.label}>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-faint">{t.label}</div>
                    <div className="font-mono text-[17px] text-ink">{t.v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
