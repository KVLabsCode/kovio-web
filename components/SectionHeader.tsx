import type { ReactNode } from 'react';
import RangePills from './RangePills';

type Props = {
  label: string;
  greeting?: string;
  subtitle?: string;
  rangePills?: string[];
  activePill?: string;
  rightActions?: ReactNode;
};

// Renders the greeting with its last word in italic serif.
function Greeting({ text }: { text: string }) {
  const words = text.trim().split(' ');
  const last = words.pop();
  return (
    <h1 className="font-serif text-display text-ink">
      {words.join(' ')} {words.length > 0 ? ' ' : ''}
      <em className="italic">{last}</em>
    </h1>
  );
}

export function SectionHeader({
  label,
  greeting,
  subtitle,
  rangePills,
  activePill,
  rightActions,
}: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="font-mono text-label uppercase text-ink-3">{label}</div>
        {greeting && (
          <div className="mt-3">
            <Greeting text={greeting} />
          </div>
        )}
        {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {rangePills && activePill && <RangePills pills={rangePills} active={activePill} />}
        {rightActions}
      </div>
    </div>
  );
}
