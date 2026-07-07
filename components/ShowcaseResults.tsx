'use client';

import { youtubeEmbedUrl, compact, fullMetrics, type ShowcaseCampaign, type ShowcaseMetrics } from '@/lib/showcase';

const mono = 'font-mono uppercase tracking-[0.14em]';

// --- tiny inline icons (design system: no emoji) ---------------------------
function Icon({ kind }: { kind: 'eye' | 'camera' | 'qr' | 'touch' | 'walk' }) {
  const s = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.9 };
  if (kind === 'eye')
    return (
      <svg {...s}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.6" /></svg>
    );
  if (kind === 'camera')
    return (
      <svg {...s}><rect x="7" y="3.5" width="10" height="17" rx="2.2" /><path d="M10.5 18.5h3" strokeLinecap="round" /></svg>
    );
  if (kind === 'qr')
    return (
      <svg {...s}><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><path d="M14 14h2.6v2.6H14zM17.5 17.5H20V20h-2.5z" fill="currentColor" stroke="none" /></svg>
    );
  if (kind === 'touch')
    return (
      <svg {...s}><path d="M9.5 11V5.5a2 2 0 1 1 4 0V11m0-2.5a2 2 0 0 1 4 0V13c0 4-2.5 7-6.5 7-3 0-4.6-1.4-6-4l-1.6-3.2a1.8 1.8 0 0 1 3-1.8L8 12.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    );
  return (
    <svg {...s}><circle cx="12" cy="4.6" r="2" /><path d="M12 7v5.5m0 0-3.5 7m3.5-7 3.5 7M7 10l5-1.7L17 10" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function Video({ c }: { c: ShowcaseCampaign }) {
  if (!c.video_url) {
    return (
      <div className="flex aspect-[9/14] w-full items-center justify-center rounded-[14px] border border-dashed border-line-strong bg-panel">
        <span className={`${mono} text-[10px] text-faint`}>Hawkeye footage</span>
      </div>
    );
  }
  if (c.video_kind === 'youtube') {
    const embed = youtubeEmbedUrl(c.video_url);
    if (embed)
      return (
        <iframe
          src={embed}
          title={`${c.name} footage`}
          className="aspect-[9/14] w-full rounded-[14px] border-0 bg-black"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      );
  }
  return <video src={c.video_url} controls playsInline className="aspect-[9/14] w-full rounded-[14px] bg-black object-cover" />;
}

// Area chart for "when they looked".
function HourlyChart({ m }: { m: ShowcaseMetrics }) {
  const vals = m.hourly?.length ? m.hourly : [1];
  const max = Math.max(...vals, 1);
  const W = 100;
  const H = 34;
  const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * W},${H - (v / max) * (H - 4)}`);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[110px] w-full">
        <polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} className="fill-accent/25" />
        <polyline points={pts.join(' ')} className="fill-none stroke-accent" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1.5 flex justify-between">
        {(m.hourly_labels ?? []).map((l) => (
          <span key={l} className={`${mono} text-[9px] text-faint`}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function CampaignBlock({ c }: { c: ShowcaseCampaign }) {
  const m = fullMetrics(c);
  const lookPct = ((m.attention_rate ?? 0) * 100).toFixed(1);
  const engagedPct = ((m.engagements / Math.max(1, m.impressions)) * 100).toFixed(1);
  const signals = [
    { icon: 'eye' as const, v: compact(m.views), label: 'Views', desc: 'People who looked at the screen' },
    { icon: 'camera' as const, v: compact(m.captures), label: 'Captures', desc: 'Phones raised to film or photograph the robot' },
    { icon: 'qr' as const, v: compact(m.qr_scans), label: 'QR scans', desc: 'People who scanned the on-screen code' },
    { icon: 'touch' as const, v: compact(m.touches), label: 'Touches', desc: 'People who touched the screen' },
    { icon: 'walk' as const, v: compact(m.approaches), label: 'Approaches', desc: 'People who stepped toward the robot' },
  ];
  const funnel = [
    { label: 'Walked by', v: m.impressions, pct: 100 },
    { label: 'Looked', v: m.attended, pct: Number(lookPct) },
    { label: 'Engaged', v: m.engagements, pct: Number(engagedPct) },
  ];

  return (
    <section className="rounded-[18px] border border-line bg-panel">
      {/* card header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-6 sm:px-8">
        <div>
          {c.location_label && <div className={`${mono} text-[10px] text-accent-dark`}>{c.location_label}</div>}
          <h2 className="mt-1 font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.015em] text-ink sm:text-[34px]">
            {c.name}
          </h2>
        </div>
        {c.duration_label && (
          <span className={`${mono} rounded-full bg-tint px-3.5 py-1.5 text-[9px] text-accent-dark`}>{c.duration_label}</span>
        )}
      </div>

      {/* inner report */}
      <div className="mx-3 mb-3 rounded-[14px] bg-bg p-4 sm:mx-4 sm:mb-4 sm:p-6">
        {/* attention hero + key tiles */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[14px] border border-tint-line bg-tint p-5 sm:p-6">
            <div className={`${mono} text-[10px] text-accent-dark`}>Verified attention</div>
            <div className="mt-2 font-serif text-[56px] leading-none tracking-[-0.02em] text-ink sm:text-[68px]">
              {lookPct}%
            </div>
            <p className="mt-3 max-w-[300px] text-[13px] leading-[1.5] text-muted">
              {compact(m.attended)} of {compact(m.impressions)} people who passed turned to look — measured on
              the robot, faces never stored.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Impressions', v: compact(m.impressions) },
              { label: 'Looked', v: compact(m.attended) },
              { label: 'Avg dwell', v: `${m.avg_dwell_s}s` },
              { label: 'Captures', v: compact(m.captures) },
            ].map((t) => (
              <div key={t.label} className="rounded-[14px] border border-line bg-panel p-4">
                <div className={`${mono} text-[9px] text-faint`}>{t.label}</div>
                <div className="mt-1.5 font-serif text-[30px] leading-none text-ink">{t.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* engagement signals */}
        <div className={`${mono} mt-6 text-[10px] text-faint`}>Engagement signals</div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {signals.map((s) => (
            <div key={s.label} className="rounded-[13px] border border-line bg-panel p-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tint text-accent-dark">
                <Icon kind={s.icon} />
              </div>
              <div className="mt-2.5 font-serif text-[24px] leading-none text-ink">{s.v}</div>
              <div className={`${mono} mt-1.5 text-[9px] text-accent-dark`}>{s.label}</div>
              <div className="mt-1 text-[11px] leading-[1.35] text-muted">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* funnel + charts | video */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className={`${mono} text-[10px] text-faint`}>Attention funnel</div>
            <div className="mt-3 space-y-2.5">
              {funnel.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className={`${mono} w-[74px] shrink-0 text-[9px] text-muted`}>{f.label}</span>
                  <div className="h-[20px] flex-1 overflow-hidden rounded-[5px] bg-panel">
                    <div className="h-full rounded-[5px] bg-accent" style={{ width: `${Math.max(2, f.pct)}%` }} />
                  </div>
                  <span className="w-[92px] shrink-0 text-right text-[12px] text-muted">
                    <span className="font-semibold text-ink">{compact(f.v)}</span> {f.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>

            <div className={`${mono} mt-7 text-[10px] text-faint`}>When they looked</div>
            <div className="mt-2">
              <HourlyChart m={m} />
            </div>

            <div className={`${mono} mt-6 text-[10px] text-faint`}>How long they looked</div>
            <div className="mt-2.5 flex h-[14px] overflow-hidden rounded-[5px]">
              <div className="bg-tint-line" style={{ width: `${m.dwell_glance_pct}%` }} />
              <div className="bg-accent" style={{ width: `${m.dwell_looked_pct}%` }} />
              <div className="bg-good" style={{ width: `${m.dwell_watched_pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted">
              <span>Glance <span className="font-semibold text-ink">{m.dwell_glance_pct}%</span></span>
              <span>Looked <span className="font-semibold text-ink">{m.dwell_looked_pct}%</span></span>
              <span>Watched <span className="font-semibold text-ink">{m.dwell_watched_pct}%</span></span>
            </div>
          </div>

          <div>
            <div className={`${mono} mb-2.5 text-[10px] text-faint`}>On the robot</div>
            <Video c={c} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ShowcaseResults({
  orgName,
  campaigns,
  locked = false,
}: {
  orgName: string;
  campaigns: ShowcaseCampaign[];
  locked?: boolean;
}) {
  const enriched = campaigns.map((c) => fullMetrics(c));
  const totals = enriched.reduce(
    (t, m) => ({ impressions: t.impressions + m.impressions, attended: t.attended + m.attended }),
    { impressions: 0, attended: 0 },
  );

  return (
    <div>
      {/* header — always sharp */}
      <div className={`${mono} text-[10px] text-accent-dark`}>Kovio · Campaign results</div>
      <h1 className="mt-2 font-serif text-[clamp(44px,7vw,64px)] font-medium leading-[1.02] tracking-[-0.02em] text-ink">
        {orgName}
      </h1>
      <p className="mt-3 max-w-[420px] text-[14px] leading-[1.55] text-muted">
        Advertising that walked the city — measured frame by frame on the robot. Here’s how it went.
      </p>

      {/* Everything below blurs until the account is claimed. */}
      <div className="relative">
        <div className={locked ? 'pointer-events-none select-none blur-[9px]' : ''} aria-hidden={locked}>
          {/* totals strip */}
          <div className="mt-6 inline-grid grid-cols-3 divide-x divide-line overflow-hidden rounded-[12px] border border-line bg-panel">
            {[
              { label: 'Campaigns', v: `${campaigns.length}` },
              { label: 'Impressions', v: compact(totals.impressions) },
              { label: 'People who looked', v: compact(totals.attended) },
            ].map((t) => (
              <div key={t.label} className="px-6 py-3.5">
                <div className={`${mono} whitespace-nowrap text-[9px] text-faint`}>{t.label}</div>
                <div className="mt-1 font-serif text-[26px] leading-none text-ink">{t.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-8">
            {campaigns.map((c, i) => (
              <CampaignBlock key={c.id ?? i} c={c} />
            ))}
          </div>

          <p className="mt-5 text-[11px] text-faint">
            Directional estimates from Hawkeye processing — full verified reporting lives in your dashboard.
          </p>
        </div>

        {locked && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-[140px]">
            <div className="sticky top-1/3 mx-4 max-w-[380px] rounded-[18px] border border-tint-line bg-panel/95 p-7 text-center shadow-[0_20px_60px_rgba(28,26,24,0.18)] backdrop-blur">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-tint text-accent-dark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
                  <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="mt-3.5 font-serif text-[24px] font-medium leading-[1.15] text-ink">
                Your results are ready.
              </div>
              <p className="mt-2 text-[14px] leading-[1.5] text-muted">
                {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'} ran on the Robot.com fleet —
                claim your {orgName} dashboard below to reveal them and launch for real.
              </p>
              <a
                href="#claim-bar"
                className="mt-4 inline-flex rounded-[11px] bg-accent px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-accent-dark"
              >
                Claim your dashboard ↓
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
