'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Campaign search (design's top-bar field). Submitting jumps to the campaigns
// list filtered by name (?q=). Enter or the icon both work.
export default function TopbarSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? `/campaigns?q=${encodeURIComponent(t)}` : '/campaigns');
  }

  return (
    <form onSubmit={submit} className="relative hidden md:block">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search campaigns…"
        aria-label="Search campaigns"
        className="w-[220px] rounded-[10px] border border-line bg-panel py-2 pl-9 pr-3 text-[14px] text-ink outline-none transition-colors focus:border-accent"
      />
      <button type="submit" aria-label="Search" className="absolute left-2.5 top-1/2 -translate-y-1/2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" className="stroke-faint" strokeWidth="1.8" />
          <path d="m20 20-3-3" className="stroke-faint" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
