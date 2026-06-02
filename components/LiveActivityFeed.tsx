import { formatMoney } from '@/lib/format';

export type ActivityEvent = {
  id: string;
  time: string;
  type: 'qr_scan' | 'engagement' | 'impression' | 'verbal';
  title: string;
  location: string;
  value_cents: number;
};

const DOT: Record<ActivityEvent['type'], string> = {
  qr_scan: 'bg-rust',
  engagement: 'bg-rust',
  impression: 'bg-navy',
  verbal: 'bg-navy',
};

export function LiveActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="rounded-lg border border-border-soft bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base text-ink">Live activity</h3>
        <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Streaming
        </span>
      </div>
      <div className="mt-1 font-mono text-label uppercase text-ink-3">
        Verified events · last 2 minutes
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">
          No verified events yet — they appear here as robots play your ads.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-3 border-b border-dashed border-border-soft py-3 last:border-0"
            >
              <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-ink-3">{e.time}</span>
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[e.type]}`} />
              <span className="flex-1">
                <span className="block text-sm text-ink">{e.title}</span>
                <span className="block text-xs text-ink-3">{e.location}</span>
              </span>
              <span className="shrink-0 font-mono text-sm text-rust">
                +{formatMoney(e.value_cents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
