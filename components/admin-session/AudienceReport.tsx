'use client';

// Audience report for one custom display: measured (LiDAR+depth) session
// metrics rolled up honestly — single-creative sessions grouped under their
// campaign, blended (looping) sessions kept display-scoped and labeled, never
// shown as any campaign's number. CSV/JSON export of the per-session rows.

import { useEffect, useMemo, useState } from 'react';
import {
  sessionApi,
  type AudienceRollup,
  type AudienceSessionRow,
  type SessionCampaign,
} from '@/components/admin-session/kovioClient';

function fmtWindow(r: AudienceSessionRow): string {
  const start = new Date(r.started_at).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const end = r.ended_at
    ? new Date(r.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'live';
  return `${start} → ${end}`;
}

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rollup: AudienceRollup, campaignNames: Map<string, string>): string {
  const header = [
    'session_id', 'started_at', 'ended_at', 'attribution', 'campaign_id',
    'display_id', 'reach_unique', 'passersby_gross', 'dwell_engaged_plus',
    'dwell_deep', 'close_approaches',
  ];
  const lines = rollup.sessions.map((s) => {
    const attribution = s.is_blended || !s.campaign_id
      ? 'blended'
      : `campaign:${campaignNames.get(s.campaign_id) ?? s.campaign_id}`;
    return [
      s.session_id, s.started_at, s.ended_at ?? '', attribution,
      s.is_blended ? '' : (s.campaign_id ?? ''), s.display_id ?? '',
      s.reach_unique, s.passersby_gross, s.dwell_engaged_plus,
      s.dwell_deep, s.close_approaches,
    ].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

function MetricCells({ r }: { r: { reach_unique: number; dwell_engaged_plus: number; close_approaches: number; passersby_gross: number } }) {
  return (
    <>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.reach_unique}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.dwell_engaged_plus}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{r.close_approaches}</td>
      <td className="px-2 py-1.5 text-right tabular-nums opacity-50">{r.passersby_gross}</td>
    </>
  );
}

export default function AudienceReport({ displayId }: { displayId: string }) {
  const [rollup, setRollup] = useState<AudienceRollup | null>(null);
  const [campaigns, setCampaigns] = useState<SessionCampaign[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([sessionApi.displayAudience(displayId), sessionApi.campaigns().catch(() => [])])
      .then(([r, cs]) => {
        if (cancelled) return;
        setRollup(r);
        setCampaigns(cs);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the report.');
      });
    return () => {
      cancelled = true;
    };
  }, [displayId]);

  const campaignNames = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c.name])),
    [campaigns]
  );

  const groups = useMemo(() => {
    if (!rollup) return [];
    const byCampaign = new Map<string, AudienceSessionRow[]>();
    const blended: AudienceSessionRow[] = [];
    for (const s of rollup.sessions) {
      if (s.is_blended || !s.campaign_id) blended.push(s);
      else {
        const list = byCampaign.get(s.campaign_id) ?? [];
        list.push(s);
        byCampaign.set(s.campaign_id, list);
      }
    }
    const out: { title: string; badge: 'campaign' | 'blended'; rows: AudienceSessionRow[] }[] = [];
    for (const [cid, rows] of byCampaign) {
      out.push({ title: campaignNames.get(cid) ?? cid, badge: 'campaign', rows });
    }
    if (blended.length > 0) {
      out.push({
        title: `Blended across ${rollup.creative_count ?? 'multiple'} creatives — not attributable to a single advertiser`,
        badge: 'blended',
        rows: blended,
      });
    }
    return out;
  }, [rollup, campaignNames]);

  if (error) return <p className="mt-3 text-xs text-danger">{error}</p>;
  if (!rollup) return <p className="mt-3 font-mono text-[11px] opacity-50">loading report…</p>;

  return (
    <div className="mt-4 rounded-lg border border-border-soft bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider opacity-70">
          Audience report · {rollup.sessions.length} session{rollup.sessions.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => download(`kovio-audience-${displayId.slice(0, 8)}.csv`, 'text/csv', toCsv(rollup, campaignNames))}
            className="rounded-md border border-border-soft px-2.5 py-1 text-xs text-ink hover:bg-page"
          >
            Export CSV
          </button>
          <button
            onClick={() => download(`kovio-audience-${displayId.slice(0, 8)}.json`, 'application/json', JSON.stringify(rollup, null, 2))}
            className="rounded-md border border-border-soft px-2.5 py-1 text-xs text-ink hover:bg-page"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* totals strip — measured, deduplicated */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Unique reach', rollup.reach_unique],
          ['Dwell (engaged+)', rollup.dwell_engaged_plus],
          ['Close approaches', rollup.close_approaches],
          ['Gross passersby', rollup.passersby_gross],
        ].map(([label, v]) => (
          <div key={String(label)} className="rounded-md border border-border-soft bg-page p-2">
            <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">{label}</div>
            <div className="text-[18px] font-semibold tabular-nums">{String(v)}</div>
          </div>
        ))}
      </div>

      {rollup.sessions.length === 0 && (
        <p className="mt-3 text-xs text-ink-2">
          No measured sessions yet — run a session with the V2 perception agent to populate this.
        </p>
      )}

      {groups.map((g) => (
        <div key={g.title} className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-ink">{g.title}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                g.badge === 'blended' ? 'bg-rust/10 text-rust' : 'bg-good/10 text-good'
              }`}
            >
              {g.badge}
            </span>
          </div>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-xs text-ink-2">
              <thead>
                <tr className="border-b border-border-soft text-left font-mono text-[10px] uppercase tracking-wider opacity-60">
                  <th className="px-2 py-1.5">Session window</th>
                  <th className="px-2 py-1.5 text-right">Reach</th>
                  <th className="px-2 py-1.5 text-right">Dwell eng+</th>
                  <th className="px-2 py-1.5 text-right">Close</th>
                  <th className="px-2 py-1.5 text-right">Gross</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.session_id} className="border-b border-border-soft/50">
                    <td className="px-2 py-1.5">{fmtWindow(r)}</td>
                    <MetricCells r={r} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
