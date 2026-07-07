'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OfferComments from '@/components/OfferComments';
import { usd, dateRange, type MyOffer } from '@/lib/offers';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-tint text-accent-dark',
  countered: 'bg-navy/10 text-navy',
  accepted: 'bg-good/10 text-good',
  rejected: 'border border-line-strong text-muted',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'In review',
  countered: 'New dates proposed',
  accepted: 'Accepted',
  rejected: 'Not accepted',
};

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="text-[14px] text-ink">{value}</div>
    </div>
  );
}

function Card({ offer }: { offer: MyOffer }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'' | 'accept' | 'decline'>('');
  const [error, setError] = useState('');

  async function respond(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline');
    setError('');
    const res = await fetch('/api/offers/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: offer.id, accept }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy('');
      setError(json.error ?? 'Could not save your response.');
      return;
    }
    router.refresh();
  }

  const c = offer.counter;

  return (
    <div className="rounded-[16px] border border-line bg-panel p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[17px] font-medium text-ink">{offer.name}</div>
          <div className="mt-0.5 text-[14px] text-muted">
            with <span className="text-ink">{offer.oem_name}</span>
            {offer.fleet_name ? ` · ${offer.fleet_name}` : ''}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[offer.status] ?? ''}`}>
          {STATUS_LABEL[offer.status] ?? offer.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
        <Term label="Budget" value={usd(offer.budget_total_cents)} />
        <Term label="Dates" value={dateRange(offer.start_at, offer.end_at)} />
        <Term label="Time" value={offer.time_window ?? '—'} />
        <Term label="Location" value={offer.location_label ?? offer.fleet_name ?? '—'} />
      </div>

      {/* The operator sent it back with new dates — confirm or decline. */}
      {offer.status === 'countered' && c && (
        <div className="mt-4 rounded-[12px] border border-navy/30 bg-navy/5 p-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-navy">
            The operator proposed new dates
          </div>
          {offer.counter_note && <p className="mt-1 text-[13px] text-muted">“{offer.counter_note}”</p>}
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 text-[15px]">
            <span className="text-muted line-through">{dateRange(offer.start_at, offer.end_at)}</span>
            <span className="text-faint">→</span>
            <span className="font-medium text-ink">{dateRange(c.start_at ?? null, c.end_at ?? null)}</span>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => respond(true)}
              disabled={!!busy}
              className="rounded-[10px] bg-accent px-5 py-2.5 text-[14px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
            >
              {busy === 'accept' ? 'Confirming…' : 'Confirm new dates'}
            </button>
            <button
              onClick={() => respond(false)}
              disabled={!!busy}
              className="rounded-[10px] border border-line-strong px-5 py-2.5 text-[14px] text-ink transition-colors hover:border-accent disabled:opacity-50"
            >
              {busy === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </div>
        </div>
      )}

      {offer.status === 'rejected' && offer.decision_reason && (
        <p className="mt-3 text-[13px] text-muted">Operator’s note: {offer.decision_reason}</p>
      )}

      <OfferComments offerId={offer.id} />
    </div>
  );
}

export default function MyPlacements({ offers }: { offers: MyOffer[] }) {
  if (!offers || offers.length === 0) {
    return (
      <div className="mt-8 rounded-[18px] border border-dashed border-line-strong py-16 text-center">
        <p className="font-serif text-[28px] text-ink">No placements yet</p>
        <p className="mt-2 text-[16px] text-muted">Submit a campaign to the Robot.com fleet to see it here.</p>
        <Link href="/campaigns/place" className="mt-6 inline-flex rounded-[11px] bg-accent px-6 py-3 text-[15px] text-white transition-colors hover:bg-accent-dark">
          Place a campaign
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-8 grid gap-4">
      {offers.map((o) => (
        <Card key={o.id} offer={o} />
      ))}
    </div>
  );
}
