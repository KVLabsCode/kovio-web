'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usd, summarizeTargeting, type IncomingOffer } from '@/lib/offers';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function OfferCard({ offer }: { offer: IncomingOffer }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'' | 'accepted' | 'rejected'>('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function decide(decision: 'accepted' | 'rejected') {
    setBusy(decision);
    setError('');
    const res = await fetch('/api/offers/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: offer.id, decision, reason: decision === 'rejected' ? reason : undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy('');
      setError(json.error ?? 'Could not save your decision.');
      return;
    }
    router.refresh();
  }

  const decided = offer.status !== 'pending';

  return (
    <div className={`rounded-lg border bg-card p-5 ${decided ? 'border-border-soft opacity-80' : 'border-rust/40'}`}>
      <div className="flex gap-4">
        {/* Creative */}
        <div className="h-24 w-32 shrink-0 overflow-hidden rounded-md bg-black">
          {offer.creative_url ? (
            offer.creative_type === 'video' ? (
              <video src={offer.creative_url} muted className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={offer.creative_url} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-ink-3">no creative</div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-medium text-ink">{offer.name}</div>
              <div className="mt-0.5 text-sm text-ink-2">
                from <span className="text-ink">{offer.advertiser_name}</span> · {timeAgo(offer.created_at)}
              </div>
            </div>
            {decided ? (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                  offer.status === 'accepted' ? 'bg-good/10 text-good' : 'border border-border-soft text-ink-2'
                }`}
              >
                {offer.status === 'accepted' ? 'Accepted' : 'Rejected'}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-rust/10 px-2.5 py-1 text-xs text-rust">Pending review</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
            {offer.category && <span>Category · <span className="text-ink">{offer.category}</span></span>}
            <span>Budget · <span className="text-ink">{usd(offer.budget_total_cents)}</span></span>
            {offer.fleet_name && <span>Fleet · <span className="text-ink">{offer.fleet_name}</span></span>}
            <span>When · <span className="text-ink">{summarizeTargeting(offer.targeting)}</span></span>
          </div>

          {offer.message && (
            <p className="mt-3 rounded-md border border-border-soft bg-page px-3 py-2 text-sm text-ink-2">
              “{offer.message}”
            </p>
          )}

          {decided && offer.decision_reason && (
            <p className="mt-2 text-xs text-ink-2">Reason: {offer.decision_reason}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {!decided && (
        <div className="mt-4 border-t border-border-soft pt-4">
          {rejecting ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional, shared with the advertiser)"
                className="flex-1 rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => decide('rejected')}
                  disabled={!!busy}
                  className="rounded-md bg-danger px-4 py-2 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {busy === 'rejected' ? 'Rejecting…' : 'Confirm reject'}
                </button>
                <button onClick={() => setRejecting(false)} disabled={!!busy} className="rounded-md border border-border-soft px-4 py-2 text-sm text-ink">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => decide('accepted')}
                disabled={!!busy}
                className="rounded-md bg-rust px-4 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-50"
              >
                {busy === 'accepted' ? 'Accepting…' : 'Accept'}
              </button>
              <button
                onClick={() => setRejecting(true)}
                disabled={!!busy}
                className="rounded-md border border-border-soft px-4 py-2 text-sm text-ink transition-colors hover:bg-page"
              >
                Reject
              </button>
              {offer.creative_url && (
                <a
                  href={offer.creative_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-sm text-ink-2 transition-colors hover:text-ink"
                >
                  View creative ↗
                </a>
              )}
            </div>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function IncomingOffers({ offers }: { offers: IncomingOffer[] }) {
  if (!offers || offers.length === 0) return null;
  const pending = offers.filter((o) => o.status === 'pending');

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-serif text-h2 text-ink">Incoming custom campaigns</h2>
        {pending.length > 0 && (
          <span className="rounded-full bg-rust px-2 py-0.5 text-xs font-medium text-page">{pending.length} new</span>
        )}
      </div>
      <p className="mb-4 max-w-2xl text-sm text-ink-2">
        Advertisers who want to run creative on your robots. Review the content and accept or reject —
        nothing runs on your fleet without your approval.
      </p>
      <div className="grid gap-3">
        {offers.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
      </div>
    </section>
  );
}
