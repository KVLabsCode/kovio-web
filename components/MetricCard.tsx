type Delta = { value: string; direction: 'up' | 'down' };

type Props = {
  label: string;
  value: string;
  delta?: Delta;
  context?: string;
  sparkline?: number[];
  sparklineColor?: 'rust' | 'navy';
};

function Sparkline({ data, color }: { data: number[]; color: 'rust' | 'navy' }) {
  if (!data || data.length < 2) return null;
  const w = 60;
  const h = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = color === 'navy' ? 'var(--color-navy)' : 'var(--color-rust)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  context,
  sparkline,
  sparklineColor = 'rust',
}: Props) {
  return (
    <div className="rounded-lg border border-border-soft bg-card p-6">
      <div className="font-mono text-label uppercase text-ink-3">{label}</div>
      <div className="mt-3 text-metric font-sans text-ink">{value}</div>
      <div className="mt-2 flex items-center justify-between">
        {delta ? (
          <span
            className={`text-[13px] ${delta.direction === 'up' ? 'text-rust' : 'text-navy'}`}
          >
            {delta.direction === 'up' ? '↗' : '↘'} {delta.value}
          </span>
        ) : (
          <span />
        )}
        <Sparkline data={sparkline ?? []} color={sparklineColor} />
      </div>
      {context && (
        <>
          <div className="my-3 border-t border-dashed border-border-soft" />
          <div className="text-xs text-ink-3">{context}</div>
        </>
      )}
    </div>
  );
}
