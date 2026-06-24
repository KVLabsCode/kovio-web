'use client';

import { useEffect, useState } from 'react';
import { FLEET_GO_LIVE, daysUntil, goLiveLabel } from '@/lib/fleet-clips';

// Client-only countdown to the fleet go-live date ("Live in 5 days"). Renders
// nothing until mounted so it stays hydration-safe — the server can't know
// "today", and the surrounding markup already shows the static date.
export default function FleetCountdown({ className }: { className?: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(goLiveLabel(daysUntil(FLEET_GO_LIVE, new Date())));
  }, []);

  if (!label) return null;
  return <span className={className}>{label}</span>;
}
