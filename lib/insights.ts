// Deterministic "Kovio Intelligence" insight builder (v1).
//
// Produces an executive summary, key findings, and recommended actions purely
// from REAL campaign + dashboard metrics — no fabricated GMV/ROAS, no external
// API. This is the clean seam to later swap in a real LLM call: keep the same
// Insight return shape and replace the body of buildInsights().

import type { Campaign, Dashboard } from '@/lib/types';
import { attentionRate, formatCount, formatMoney, formatPct } from '@/lib/format';

export type Tone = 'ink' | 'accent' | 'good';
export interface Segment {
  text: string;
  tone?: Tone;
}
export interface Finding {
  stat: string;
  title: string;
  body: string;
}
export interface Action {
  title: string;
  rationale: string;
  impact: string;
}
export interface Insight {
  analyzed: number;
  summary: Segment[];
  findings: Finding[];
  actions: Action[];
}

function rateOf(c: Campaign): number | null {
  return attentionRate(c);
}

export function buildInsights(campaigns: Campaign[], dash: Dashboard): Insight {
  const analyzed = dash.impressions_30d || campaigns.reduce((s, c) => s + (c.impressions_total ?? 0), 0);
  const totalWalked = campaigns.reduce((s, c) => s + (c.walked_by_total ?? 0), 0);
  const totalAttended = campaigns.reduce((s, c) => s + (c.attended_total ?? 0), 0);
  const overallAtt = attentionRate({ walked_by_total: totalWalked, attended_total: totalAttended });
  const totalSpend = dash.spent_30d_cents;
  const dwell = dash.audience_30d.avg_dwell_s;

  // Rank by reach and by attention quality.
  const byImpr = [...campaigns].sort((a, b) => (b.impressions_total ?? 0) - (a.impressions_total ?? 0));
  const rated = campaigns.filter((c) => rateOf(c) != null);
  const byAtt = [...rated].sort((a, b) => (rateOf(b) ?? 0) - (rateOf(a) ?? 0));
  const top = byImpr[0];
  const best = byAtt[0];
  const worst = byAtt[byAtt.length - 1];

  // ---- Executive summary (honest, real numbers) ----
  const summary: Segment[] = [{ text: 'Across ' }];
  summary.push({ text: `${formatCount(analyzed)} verified interactions`, tone: 'accent' });
  summary.push({ text: ' this period, your campaigns held ' });
  summary.push({ text: overallAtt != null ? `${formatPct(overallAtt)} verified attention` : 'verified attention', tone: overallAtt != null ? 'good' : 'ink' });
  summary.push({ text: ' on ' });
  summary.push({ text: formatMoney(totalSpend), tone: 'ink' });
  summary.push({ text: ' of measured spend.' });
  if (top) {
    summary.push({ text: ` ${top.name}` , tone: 'ink' });
    summary.push({ text: ` leads on reach (${formatCount(top.impressions_total ?? 0)} impressions)` });
    if (best && rateOf(best) != null) {
      summary.push({ text: `, while ` });
      summary.push({ text: best.name, tone: 'ink' });
      summary.push({ text: ` holds the strongest attention at ${formatPct(rateOf(best)!)}.` });
    } else {
      summary.push({ text: '.' });
    }
  }
  summary.push({ text: ' Conversion/GMV attribution is not yet wired, so these insights focus on measured reach, attention and spend.' });

  // ---- Key findings ----
  const findings: Finding[] = [];
  if (best && rateOf(best) != null) {
    findings.push({
      stat: formatPct(rateOf(best)!),
      title: `${best.name} wins attention`,
      body: 'Your highest verified-attention campaign. A strong template for the rest of the roster.',
    });
  }
  findings.push({
    stat: dwell > 0 ? `${dwell}s` : '—',
    title: 'Dwell on look',
    body: dwell > 0
      ? 'Average time a viewer held attention, measured on-device by LiDAR.'
      : 'No dwell telemetry yet. It appears here once your fleet reports it.',
  });
  findings.push({
    stat: formatCount(totalWalked),
    title: 'People reached',
    body: `${formatCount(totalAttended)} of them actually looked. The top of your verified funnel.`,
  });

  // ---- Recommended actions (data-grounded, honest impact) ----
  const actions: Action[] = [];
  if (best && top && best.id !== top.id) {
    actions.push({
      title: `Shift more budget toward "${best.name}".`,
      rationale: 'It holds the highest verified attention rate in your roster.',
      impact: 'higher attention',
    });
  }
  if (worst && best && worst.id !== best.id && rateOf(worst) != null) {
    actions.push({
      title: `Review the creative on "${worst.name}".`,
      rationale: `It trails the roster on attention (${formatPct(rateOf(worst)!)}).`,
      impact: 'recover attention',
    });
  }
  actions.push({
    title: 'Keep creatives short, aim for ≤ 6 seconds.',
    rationale: 'Shorter spots hold attention through the dwell window.',
    impact: 'more completed looks',
  });

  return { analyzed, summary, findings: findings.slice(0, 3), actions: actions.slice(0, 3) };
}

// Activity-by-hour distribution from recent verified events (real, sampled).
export function hourlyDistribution(dash: Dashboard): { hour: number; count: number }[] {
  const buckets = new Array(24).fill(0);
  for (const r of dash.recent_impressions) {
    const t = new Date(r.timestamp);
    if (!Number.isNaN(t.getTime())) buckets[t.getHours()] += 1;
  }
  // 8am–10pm window to match the report's dayparting view.
  return Array.from({ length: 15 }, (_, i) => i + 8).map((hour) => ({ hour, count: buckets[hour] }));
}
