'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Props = {
  data: Array<Record<string, unknown>>;
  primaryKey: string;
  primaryLabel: string;
  secondaryKey?: string;
  secondaryLabel?: string;
  xKey: string;
  primaryFormat?: (v: number) => string;
  secondaryFormat?: (v: number) => string;
};

const tickStyle = {
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  fill: 'var(--color-ink-3)',
};

function formatDate(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Chart({
  data,
  primaryKey,
  primaryLabel,
  secondaryKey,
  secondaryLabel,
  xKey,
  primaryFormat = (v) => String(v),
  secondaryFormat = (v) => String(v),
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-3">
        Chart populates after a few days of activity.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-border-soft)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickFormatter={formatDate}
          tick={tickStyle}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border-soft)' }}
        />
        <YAxis
          tickFormatter={(v) => primaryFormat(Number(v))}
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: 'var(--color-border-mid)', strokeDasharray: '3 3' }}
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null;
            return (
              <div className="rounded-md border border-border-soft bg-card px-3 py-2 text-xs shadow-sm">
                <div className="font-mono text-label uppercase text-ink-3">
                  {formatDate(String(label))}
                </div>
                <div className="mt-1 text-ink">
                  {primaryLabel} · {primaryFormat(Number(payload[0]?.value ?? 0))}
                </div>
                {secondaryKey && payload[1] != null && (
                  <div className="text-ink-2">
                    {secondaryLabel} · {secondaryFormat(Number(payload[1]?.value ?? 0))}
                  </div>
                )}
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey={primaryKey}
          stroke="var(--color-rust)"
          strokeWidth={2}
          fill="var(--color-rust)"
          fillOpacity={0.2}
        />
        {secondaryKey && (
          <Line
            type="monotone"
            dataKey={secondaryKey}
            stroke="var(--color-navy)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
