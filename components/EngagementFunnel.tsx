import type { AudienceSummary } from '@/lib/types';
import { formatCount, interactionLabel } from '@/lib/format';

// Style-neutral so it drops into either the advertiser (serif/panel) or OEM
// (card/border-soft) surfaces: it draws only bars + text and inherits colour
// from its parent. The caller supplies the surrounding panel chrome.
//
// Funnel stages come straight from the audience summary's enriched totals
// (migration 007). Bars are scaled to "passed by" so the drop-off is legible.
export function EngagementFunnel({ summary }: { summary: AudienceSummary }) {
  const reach = summary.total_reach ?? 0;
  const interactions = summary.total_interactions ?? 0;

  const stages = [
    { label: 'Passed by', value: reach, color: 'var(--color-navy, #2b3a55)' },
    { label: 'Looked', value: summary.total_looked ?? 0, color: 'var(--color-navy, #2b3a55)' },
    { label: 'Phone out', value: summary.total_phones_out ?? 0, color: 'var(--color-rust, #b4532a)' },
    { label: 'Interactions', value: interactions, color: 'var(--color-rust, #b4532a)' },
  ];
  const max = Math.max(reach, 1);
  const hasData = reach > 0 || interactions > 0;

  if (!hasData) {
    return (
      <div className="font-mono text-[11px] uppercase tracking-wider opacity-60">
        Engagement funnel · no data yet
      </div>
    );
  }

  const breakdown = Object.entries(summary.interaction_breakdown ?? {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const track = 'color-mix(in srgb, currentColor 12%, transparent)';
  const chip = 'color-mix(in srgb, currentColor 8%, transparent)';

  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wider opacity-60">
        Engagement funnel
      </div>
      <div className="mt-3 space-y-2">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-wide opacity-70">
              {s.label}
            </div>
            <div className="h-2 flex-1 rounded-full" style={{ background: track }}>
              <div
                className="h-2 rounded-full"
                style={{ width: `${Math.max(2, (s.value / max) * 100)}%`, background: s.color }}
              />
            </div>
            <div className="w-14 shrink-0 text-right font-mono text-[13px]">
              {formatCount(s.value)}
            </div>
          </div>
        ))}
      </div>
      {breakdown.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {breakdown.map(([kind, count]) => (
            <span
              key={kind}
              className="rounded-full px-2.5 py-1 font-mono text-[11px]"
              style={{ background: chip }}
            >
              {interactionLabel(kind)} · {formatCount(count)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
