'use client';

import { useEffect, useRef, useState } from 'react';

type EventKind = 'view' | 'qr' | 'touch';

interface FeedEvent {
  id: number;
  kind: EventKind;
  label: string;
  detail: string;
  ts: number; // epoch ms when created
}

const DOT: Record<EventKind, string> = {
  view: 'bg-navy',
  qr: 'bg-accent',
  touch: 'bg-good',
};

const TEMPLATES: Record<EventKind, { label: string; detail: string }> = {
  view: { label: 'View', detail: 'Pedestrian detected' },
  qr: { label: 'QR scan', detail: 'Phone camera' },
  touch: { label: 'Touch', detail: 'Screen tap' },
};

function pickKind(): EventKind {
  const r = Math.random();
  if (r < 0.8) return 'view';
  if (r < 0.95) return 'qr';
  return 'touch';
}

function makeEvent(id: number, ageSec: number): FeedEvent {
  const kind = pickKind();
  return {
    id,
    kind,
    label: TEMPLATES[kind].label,
    detail: TEMPLATES[kind].detail,
    ts: Date.now() - ageSec * 1000,
  };
}

function ago(ts: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - ts) / 1000));
  if (diff < 3) return 'just now';
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m`;
}

export default function HawkeyeFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [now, setNow] = useState(0);
  const nextId = useRef(0);

  // Seed initial events client-side (avoids hydration mismatch from Math.random).
  useEffect(() => {
    const seed: FeedEvent[] = [];
    for (let i = 0; i < 5; i++) {
      seed.push(makeEvent(nextId.current++, (i + 1) * 4));
    }
    setEvents(seed);
    setNow(Date.now());
  }, []);

  // Prepend a new event every 2.6s.
  useEffect(() => {
    const id = window.setInterval(() => {
      setEvents((prev) => {
        const next = [makeEvent(nextId.current++, 0), ...prev];
        return next.slice(0, 7);
      });
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  // Tick the "ago" timestamps.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="bg-panel border border-line rounded-[16px] px-7 py-6 flex flex-col flex-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
          LIVE ACTIVITY
        </span>
        <span className="flex items-center gap-2">
          <span className="k-pulse block rounded-full bg-accent" style={{ width: 7, height: 7 }} />
          <span className="font-mono text-[11px] text-muted">STREAMING</span>
        </span>
      </div>

      <div className="mt-2">
        {events.map((e, i) => (
          <div
            key={e.id}
            className={`flex items-center py-3.5 ${
              i === events.length - 1 ? '' : 'border-b border-line'
            }`}
          >
            <span className={`block rounded-full ${DOT[e.kind]}`} style={{ width: 9, height: 9 }} />
            <span className="text-[16px] text-ink ml-2.5">{e.label}</span>
            <span className="text-[14px] text-muted ml-2">{e.detail}</span>
            <span className="font-mono text-[12px] text-faint ml-auto">{ago(e.ts, now)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
