'use client';

import { youtubeEmbedUrl, compact, type ShowcaseCampaign } from '@/lib/showcase';

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[14px] border p-4 ${highlight ? 'border-tint-line bg-tint' : 'border-line bg-panel'}`}>
      <div className={`font-mono text-[10px] uppercase tracking-[0.12em] ${highlight ? 'text-accent-dark' : 'text-faint'}`}>
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[26px] leading-none tracking-[-0.01em] text-ink sm:text-[30px]">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function Video({ c }: { c: ShowcaseCampaign }) {
  if (!c.video_url) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-[14px] border border-dashed border-line-strong bg-panel">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">Hawkeye footage</span>
      </div>
    );
  }
  if (c.video_kind === 'youtube') {
    const embed = youtubeEmbedUrl(c.video_url);
    if (embed) {
      return (
        <iframe
          src={embed}
          title={`${c.name} footage`}
          className="aspect-video w-full rounded-[14px] border-0 bg-black"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      );
    }
  }
  return <video src={c.video_url} controls playsInline className="aspect-video w-full rounded-[14px] bg-black" />;
}

// One showcased campaign: footage + processed interaction metrics, presented
// like a real Kovio report.
function CampaignBlock({ c, index }: { c: ShowcaseCampaign; index: number }) {
  const m = c.metrics;
  const lookPct = Math.round((m.attention_rate ?? 0) * 100);
  return (
    <section className="rounded-[20px] border border-line bg-panel p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            Campaign {String(index + 1).padStart(2, '0')} · processed by Hawkeye
          </div>
          <h2 className="mt-1 font-serif text-[26px] font-medium tracking-[-0.01em] text-ink sm:text-[30px]">{c.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.location_label && (
            <span className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-muted">📍 {c.location_label}</span>
          )}
          {c.duration_label && (
            <span className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-muted">⏱ {c.duration_label}</span>
          )}
          {m.peak_window && (
            <span className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-muted">Peak {m.peak_window}</span>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Video c={c} />

        <div className="flex flex-col justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Impressions</div>
            <div className="font-mono text-[52px] leading-[1.02] tracking-[-0.02em] text-ink sm:text-[62px]">
              {m.impressions?.toLocaleString('en-US') ?? '—'}
            </div>
            <div className="mt-1 text-[13px] text-muted">
              people passed within view · ~{compact(m.foot_traffic_per_hr ?? 0)}/hr foot traffic
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Verified looks" value={compact(m.attended ?? 0)} sub="counted on-device" highlight />
            <Stat label="Attention rate" value={`${lookPct}%`} sub="of passers-by looked" />
            <Stat label="Avg dwell" value={`${m.avg_dwell_s ?? 0}s`} sub="eyes on screen" />
            <Stat label="Engagements" value={compact(m.engagements ?? 0)} sub="stopped or interacted" />
          </div>
        </div>
      </div>

      {/* attention funnel */}
      <div className="mt-5 rounded-[14px] border border-line bg-bg p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Attention funnel</div>
        {[
          { label: 'Passed by', v: m.impressions ?? 0, w: 100 },
          { label: 'Looked', v: m.attended ?? 0, w: Math.max(6, lookPct) },
          { label: 'Engaged', v: m.engagements ?? 0, w: Math.max(3, Math.round(((m.engagements ?? 0) / Math.max(1, m.impressions ?? 1)) * 100)) },
        ].map((row) => (
          <div key={row.label} className="mb-2 flex items-center gap-3 last:mb-0">
            <span className="w-20 shrink-0 text-[12px] text-muted">{row.label}</span>
            <div className="h-[18px] flex-1 overflow-hidden rounded-[5px] bg-panel">
              <div className="h-full rounded-[5px] bg-accent/80" style={{ width: `${row.w}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[13px] text-ink">{compact(row.v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ShowcaseResults({ orgName, campaigns }: { orgName: string; campaigns: ShowcaseCampaign[] }) {
  const totals = campaigns.reduce(
    (t, c) => ({
      impressions: t.impressions + (c.metrics.impressions ?? 0),
      attended: t.attended + (c.metrics.attended ?? 0),
    }),
    { impressions: 0, attended: 0 },
  );

  return (
    <div>
      {/* hero */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#332c24] px-4 py-2 text-[#f1ead9]">
          <span className="k-pulse h-[7px] w-[7px] rounded-full bg-[#5cbe85]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em]">Hawkeye · verified attention report</span>
        </div>
        <h1 className="mx-auto mt-5 max-w-[760px] font-serif text-[clamp(36px,5.5vw,58px)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
          <em className="italic text-accent-dark">{orgName}</em> on robots, in the real world.
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.55] text-muted">
          We ran your brand on the Robot.com fleet and measured who actually looked —{' '}
          <span className="font-mono text-ink">{totals.impressions.toLocaleString('en-US')}</span> impressions,{' '}
          <span className="font-mono text-ink">{compact(totals.attended)}</span> verified looks, counted
          frame-by-frame on the robot itself.
        </p>
      </div>

      <div className="mt-9 grid gap-6">
        {campaigns.map((c, i) => (
          <CampaignBlock key={c.id ?? i} c={c} index={i} />
        ))}
      </div>

      <p className="mt-4 text-center text-[11px] text-faint">
        Directional estimates from Hawkeye processing — full verified reporting lives in your dashboard.
      </p>
    </div>
  );
}
