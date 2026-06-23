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
    <div className="inline-flex items-center gap-1 rounded-[11px] border border-line bg-panel p-1">
      {pills.map((p) => (
        <button
          key={p}
          onClick={() => select(p)}
          className={`rounded-[8px] px-[14px] py-[7px] font-mono text-[12px] tracking-[0.04em] transition-colors duration-150 ${
            p === active ? 'bg-accent text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
