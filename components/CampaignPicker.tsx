'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// A real campaign selector: choosing an option navigates to ?<param>=<id>
// (or clears it for "All campaigns"). Server pages read the param and filter.
export default function CampaignPicker({
  campaigns,
  param = 'campaign',
  allLabel = 'All campaigns',
}: {
  campaigns: { id: string; name: string }[];
  param?: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? '';

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(searchParams.toString());
    if (e.target.value) next.set(param, e.target.value);
    else next.delete(param);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="relative">
      <select
        value={current}
        onChange={onChange}
        aria-label="Select campaign"
        className="cursor-pointer appearance-none rounded-[10px] border border-line bg-panel py-2.5 pl-3.5 pr-9 text-[14px] text-ink outline-none transition-colors hover:bg-panel-2 focus:border-accent"
      >
        <option value="">{allLabel}</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
      >
        <path d="m6 9 6 6 6-6" className="stroke-faint" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
