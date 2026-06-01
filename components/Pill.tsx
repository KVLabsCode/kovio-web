import type { ReactNode } from 'react';

type Variant = 'live' | 'paused' | 'draft' | 'completed' | 'rejected';

const STYLES: Record<Variant, { box: string; dot: string }> = {
  live: { box: 'bg-rust-soft text-rust-dark', dot: 'bg-rust' },
  paused: { box: 'bg-navy-soft text-navy', dot: 'bg-navy' },
  draft: { box: 'bg-page border border-border-mid text-ink-3', dot: 'bg-ink-3' },
  completed: { box: 'bg-navy-soft text-ink-3', dot: 'bg-ink-3' },
  rejected: { box: 'bg-danger/15 text-danger', dot: 'bg-danger' },
};

// Map an API campaign status to a pill variant.
export function statusVariant(status: string): Variant {
  if (status === 'active') return 'live';
  if (status === 'paused') return 'paused';
  if (status === 'completed') return 'completed';
  if (status === 'rejected') return 'rejected';
  return 'draft';
}

export function Pill({ variant, children }: { variant: Variant; children: ReactNode }) {
  const s = STYLES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs uppercase tracking-wider ${s.box}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {children}
    </span>
  );
}
