'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OfferComments from '@/components/OfferComments';
import { usd, dateRange, summarizeTargeting, type IncomingOffer } from '@/lib/offers';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className="text-sm text-ink">{value}</div>
    </div>
  );
}

const smallInput =
  'rounded-md border border-border-soft bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-rust';

// Operator proposes new dates ("run it another day") — dates + note → counter.
function ReschedulePanel({ offer, onDone }: { offer: IncomingOffer; onDone: () => void }) {
  const router = useRouter();
  const [startAt, setStartAt] = useState(offer.start_at ?? '');
  const [endAt, setEndAt] = useState(offer.end_at ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!startAt && !endAt) return setError('Pick the new dates first.');
    setBusy(true);
    setError('');
    const res = await fetch('/api/offers/counter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: offer.id, startAt: startAt || null, endAt: endAt || null, note: note.trim() || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(json.error ?? 'Could not send the new dates.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border-soft bg-page p-4">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-2">Propose new dates</div>
      <p className="mb-3 text-xs text-ink-3">
        Requested: {dateRange(offer.start_at, offer.end_at)}. The advertiser confirms the new dates before anything runs.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-ink-3">New start</label>
          <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={smallInput} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-ink-3">New end</label>
          <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={smallInput} />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why the change? (optional, shared with the advertiser)"
          className={`${smallInput} min-w-[220px] flex-1`}
        />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={send} disabled={busy} className="rounded-md bg-rust px-4 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-50">
          {busy ? 'Sending…' : 'Send to advertiser'}
        </button>
        <button onClick={onDone} disabled={busy} className="rounded-md border border-border-soft px-4 py-2 text-sm text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

function OfferCard({ offer }: { offer: IncomingOffer }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'' | 'accepted' | 'rejected'>('');
  const [mode, setMode] = useState<'' | 'reject' | 'reschedule'>('');
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

  const pending = offer.status === 'pending';
  const countered = offer.status === 'countered';
  const time = offer.time_window || summarizeTargeting(offer.targeting);
  const location = offer.location_label || offer.fleet_name || 'Any fleet';

  return (
    <div className={`rounded-lg border bg-card p-5 ${pending || countered ? 'border-rust/40' : 'border-border-soft opacity-80'}`}>
      <div className="flex gap-4">
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

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-medium text-ink">{offer.name}</div>
              <div className="mt-0.5 text-sm text-ink-2">
                from <span className="text-ink">{offer.advertiser_name}</span> · {timeAgo(offer.created_at)}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                offer.status === 'accepted'
                  ? 'bg-good/10 text-good'
                  : offer.status === 'rejected'
                    ? 'border border-border-soft text-ink-2'
                    : countered
                      ? 'bg-navy/10 text-navy'
                      : 'bg-rust/10 text-rust'
              }`}
            >
              {offer.status === 'accepted'
                ? 'Accepted'
                : offer.status === 'rejected'
                  ? 'Rejected'
                  : countered
                    ? 'New dates sent'
                    : 'Pending review'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
            <Term label="Budget" value={usd(offer.budget_total_cents)} />
            <Term label="Dates" value={dateRange(offer.start_at, offer.end_at)} />
            <Term label="Time" value={time} />
            <Term label="Location" value={location} />
            {offer.category && <Term label="Category" value={offer.category} />}
          </div>

          {offer.message && (
            <p className="mt-3 rounded-md border border-border-soft bg-page px-3 py-2 text-sm text-ink-2">“{offer.message}”</p>
          )}
          {countered && offer.counter && (
            <p className="mt-3 text-xs text-navy">
              You proposed {dateRange(offer.counter.start_at ?? null, offer.counter.end_at ?? null)}
              {offer.counter_note ? ` — “${offer.counter_note}”` : ''}. Waiting on the advertiser to confirm.
            </p>
          )}
          {offer.status === 'rejected' && offer.decision_reason && (
            <p className="mt-2 text-xs text-ink-2">Reason: {offer.decision_reason}</p>
          )}

          <OfferComments offerId={offer.id} />
        </div>
      </div>

      {pending && (
        <div className="mt-4 border-t border-border-soft pt-4">
          {mode === 'reschedule' ? (
            <ReschedulePanel offer={offer} onDone={() => setMode('')} />
          ) : mode === 'reject' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional, shared with the advertiser)"
                className="flex-1 rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust"
              />
              <div className="flex gap-2">
                <button onClick={() => decide('rejected')} disabled={!!busy} className="rounded-md bg-danger px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
                  {busy === 'rejected' ? 'Rejecting…' : 'Confirm reject'}
                </button>
                <button onClick={() => setMode('')} disabled={!!busy} className="rounded-md border border-border-soft px-4 py-2 text-sm text-ink">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => decide('accepted')} disabled={!!busy} className="rounded-md bg-rust px-4 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-50">
                {busy === 'accepted' ? 'Accepting…' : 'Accept'}
              </button>
              <button onClick={() => setMode('reschedule')} disabled={!!busy} className="rounded-md border border-border-soft px-4 py-2 text-sm text-ink transition-colors hover:bg-page">
                Propose new dates
              </button>
              <button onClick={() => setMode('reject')} disabled={!!busy} className="rounded-md border border-border-soft px-4 py-2 text-sm text-ink transition-colors hover:bg-page">
                Reject
              </button>
              {offer.creative_url && (
                <a href={offer.creative_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-ink-2 hover:text-ink">
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
  const open = offers.filter((o) => o.status === 'pending' || o.status === 'countered');

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-serif text-h2 text-ink">Incoming campaigns</h2>
        {open.length > 0 && (
          <span className="rounded-full bg-rust px-2 py-0.5 text-xs font-medium text-page">{open.length} open</span>
        )}
      </div>
      <p className="mb-4 max-w-2xl text-sm text-ink-2">
        Campaigns routed to your fleet for review. Accept, propose new dates, comment back to the
        advertiser, or reject — nothing runs without your say.
      </p>
      <div className="grid gap-3">
        {offers.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
      </div>
    </section>
  );
}
