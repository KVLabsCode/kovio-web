'use client';

import dynamic from 'next/dynamic';

// Recharts crashes when server-rendered inside a Next 16 RSC route (it relies on
// browser-only measurement). Load it client-only via ssr:false. Server pages
// import THIS wrapper instead of Chart directly.
const Chart = dynamic(() => import('./Chart'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center text-sm text-ink-3">
      Loading chart…
    </div>
  ),
});

export default Chart;
