'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Self-navigating range selector: clicking a pill updates ?range= in the URL.
// (The backend doesn't yet filter by range, so this is presentational for now —
// noted in CHOICES.md.)
export default function RangePills({
  pills,
  active,
  param = 'range',
}: {
  pills: string[];
  active: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(p: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(param, p);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex gap-1.5">
      {pills.map((p) => (
        <button
          key={p}
          onClick={() => select(p)}
          className={`rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors duration-200 ${
            p === active
              ? 'border-border-mid bg-card text-ink'
              : 'border-border-soft bg-page text-ink-3 hover:text-ink'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
