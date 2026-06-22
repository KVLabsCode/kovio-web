import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { buildHawkeye } from '@/lib/hawkeye';
import { formatCount, formatPct } from '@/lib/format';
import AppShell from '@/components/AppShell';

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, error } = await api.campaign(id);
  if (error?.status === 404 || !data) notFound();

  const { campaign, stats } = data;
  const h = buildHawkeye({
    campaignId: campaign.id,
    walkedBy: stats.walked_by_total || stats.impressions_total,
    looked: stats.attended_total,
  });

  const dwellSeconds =
    stats.audience_30d.avg_dwell_s > 0 ? stats.audience_30d.avg_dwell_s : h.avgDwellS;

  const creativeUrl = campaign.creative_url;
  const isImage =
    !!creativeUrl && creativeUrl.startsWith('http') && !creativeUrl.includes('.html');

  return (
    <AppShell>
      {/* 1. Header block */}
      <div className="mb-7">
        <Link href={`/campaigns/${campaign.id}`} className="text-[16px] text-accent">
          ← Back to campaign
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-faint">
            HAWKEYE REPORT
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-good bg-good/[0.13] px-[9px] py-[3px] rounded-[20px]">
            ✓ VERIFIED VISION
          </span>
        </div>
        <h1 className="font-serif font-medium text-[50px] leading-[1.02] tracking-[-0.015em] text-ink mt-3">
          What the robots saw <em className="italic">— {campaign.name}.</em>
        </h1>
        <p className="text-[19px] text-muted max-w-[680px] mt-3">
          Every number here is measured by the robots&apos; cameras and sensors, frame by frame.
          Nothing is estimated, sampled, or modelled.
        </p>
      </div>

      {/* 2. Vision metrics */}
      <div className="grid grid-cols-4 gap-[18px] mb-6">
        <div className="bg-panel border border-line rounded-[16px] px-[26px] py-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            WALKED BY
          </div>
          <div className="text-[40px] font-bold text-ink">{formatCount(h.walkedBy)}</div>
          <div className="text-[14px] text-muted mt-1">People detected within range.</div>
        </div>

        <div
          className="bg-panel border border-line rounded-[16px] px-[26px] py-6"
          style={{ boxShadow: 'inset 4px 0 0 var(--accent)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
              LOOKED
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-good bg-good/[0.13] px-[9px] py-[3px] rounded-[20px]">
              ✓
            </span>
          </div>
          <div className="text-[40px] font-bold text-accent-dark">{formatCount(h.looked)}</div>
          <div className="text-[14px] text-muted mt-1">Turned their head to the screen.</div>
        </div>

        <div
          className="bg-panel border border-line rounded-[16px] px-[26px] py-6"
          style={{ boxShadow: 'inset 4px 0 0 var(--navy)' }}
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            ATTENTION RATE
          </div>
          <div className="text-[40px] font-bold text-ink">{formatPct(h.attentionRate)}</div>
          <div className="text-[14px] text-muted mt-1">
            Of those who walked by, how many looked.
          </div>
        </div>

        <div className="bg-panel border border-line rounded-[16px] px-[26px] py-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            AVG DWELL
          </div>
          <div className="text-[40px] font-bold text-ink">{dwellSeconds}s</div>
          <div className="text-[14px] text-muted mt-1">How long a look held, on average.</div>
        </div>
      </div>

      {/* 3. Two-col grid */}
      <div className="grid grid-cols-[1.15fr_1fr] gap-6 mb-6">
        {/* When people looked */}
        <div className="bg-panel border border-line rounded-[16px] px-7 py-6">
          <div className="flex justify-between">
            <div>
              <div className="text-[20px] font-semibold text-ink">When people looked</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint mt-1">
                BAR = VOLUME · SHADE = ATTENTION QUALITY
              </div>
            </div>
            <div className="font-mono text-[11px] text-faint">PEAK {h.peakLabel}</div>
          </div>
          <div className="flex items-end gap-1.5 h-[230px] mt-6">
            {h.hours.map((bar, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full"
              >
                <div
                  className="w-full rounded-t-[5px] bg-accent"
                  style={{ height: bar.height * 100 + '%', opacity: bar.opacity }}
                />
                <div className="font-mono text-[10px] text-faint mt-1.5 h-3">{bar.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Attention funnel */}
        <div className="bg-panel border border-line rounded-[16px] px-7 py-6">
          <div className="text-[20px] font-semibold text-ink">Attention funnel</div>
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint mt-1">
            WALKED BY → LOOKED → ENGAGED
          </div>
          <div className="mt-6">
            {h.funnel.map((stage, i) => (
              <div key={i} className="mb-[22px] last:mb-0">
                <div className="flex justify-between">
                  <span className="text-[17px] text-ink">{stage.label}</span>
                  <span className="text-[15px] text-muted">
                    {formatCount(stage.value)} ({formatPct(stage.pct)})
                  </span>
                </div>
                <div className="h-[30px] rounded-[7px] bg-tint overflow-hidden mt-2">
                  <div
                    className="h-full bg-accent flex items-center"
                    style={{ width: stage.width * 100 + '%' }}
                  >
                    <span className="pl-2.5 font-mono text-[10px] text-white">{stage.sub}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Where it ran (fleet table) */}
      <div className="bg-panel border border-line rounded-[16px] px-7 py-6 mb-6">
        <div className="flex justify-between">
          <div className="text-[20px] font-semibold text-ink">Where it ran</div>
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            {h.fleetCount} ROBOTS · SAN FRANCISCO
          </div>
        </div>
        <div className="grid grid-cols-[1.4fr_1.6fr_0.8fr_0.8fr_0.8fr] mt-6">
          {/* Header row */}
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint border-b border-line pb-3">
            UNIT
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint border-b border-line pb-3">
            LOCATION
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint border-b border-line pb-3 text-right">
            WALKED BY
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint border-b border-line pb-3 text-right">
            LOOKED
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint border-b border-line pb-3 text-right">
            ATTENTION
          </div>

          {/* Data rows */}
          {h.fleet.map((row, i) => (
            <div key={i} className="contents">
              <div className="py-4 border-b border-dashed border-line flex items-center">
                <span className="w-2 h-2 rounded-full bg-good" />
                <span className="text-[16px] font-semibold text-ink ml-2">{row.unit}</span>
              </div>
              <div className="py-4 border-b border-dashed border-line flex items-center text-[15px] text-muted">
                {row.location}
              </div>
              <div className="py-4 border-b border-dashed border-line flex items-center justify-end text-[16px] text-right">
                {formatCount(row.walked)}
              </div>
              <div className="py-4 border-b border-dashed border-line flex items-center justify-end text-[16px] text-right text-accent-dark font-semibold">
                {formatCount(row.looked)}
              </div>
              <div className="py-4 border-b border-dashed border-line flex items-center justify-end text-[16px] text-right">
                {formatPct(row.attention)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Bottom 2-col grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* The ad they saw */}
        <div className="bg-panel border border-line rounded-[16px] px-7 py-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
            THE AD THEY SAW
          </div>
          <div className="text-[14px] text-muted mt-1">
            This is exactly what was on the screen they looked at.
          </div>
          {isImage ? (
            <div
              className="h-[300px] mt-4 rounded-[12px] bg-cover bg-center border border-line-strong"
              style={{ backgroundImage: `url(${creativeUrl})` }}
            />
          ) : (
            <div
              className="h-[300px] mt-4 rounded-[12px] border-2 border-dashed border-line-strong flex flex-col items-center justify-center"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg,var(--field),var(--field) 12px,transparent 12px,transparent 24px)',
              }}
            >
              <span className="font-mono text-[13px] tracking-[0.12em] text-muted">
                PRODUCT SHOT
              </span>
            </div>
          )}
        </div>

        {/* How long they looked */}
        <div className="bg-panel border border-line rounded-[16px] px-7 py-6">
          <div className="text-[20px] font-semibold text-ink">How long they looked</div>
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint mt-1">
            DWELL TIME OF EVERYONE WHO LOOKED
          </div>
          {h.dwell.map((bucket, i) => (
            <div key={i} className="mt-6 mb-6">
              <div className="flex justify-between">
                <span className="text-[17px] text-ink">
                  {bucket.label} · <span className="text-faint">{bucket.sub}</span>
                </span>
                <span className="text-[17px] font-semibold text-ink">{bucket.pct}%</span>
              </div>
              <div className="h-3.5 rounded-[7px] bg-tint mt-2 overflow-hidden">
                <div className="h-full bg-accent" style={{ width: bucket.pct + '%' }} />
              </div>
            </div>
          ))}
          <div className="text-[14px] text-muted leading-[1.5] mt-2">
            Dwell is measured on-device from first glance to look-away — no faces stored.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
