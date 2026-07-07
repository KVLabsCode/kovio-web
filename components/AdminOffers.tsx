'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DateField from '@/components/DateField';
import { usd, dateRange } from '@/lib/offers';
import type { AdminOperator } from '@/components/AdminOperators';

const dateFieldSm =
  'flex w-full items-center justify-between rounded-md border border-border-soft bg-card px-2.5 py-1.5 text-left text-sm text-ink outline-none focus:border-rust';

export interface AdminOffer {
  id: string;
  advertiser_name: string;
  name: string;
  creative_url: string | null;
  creative_type: string | null;
  status: string;
  target_oem_name: string | null;
  target_oem_org_id: string | null;
  budget_total_cents: number;
  start_at: string | null;
  end_at: string | null;
  time_window: string | null;
  location_label: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-rust/10 text-rust',
  accepted: 'bg-good/10 text-good',
  rejected: 'border border-border-soft text-ink-2',
  countered: 'bg-navy/10 text-navy',
};

const smallInput =
  'rounded-md border border-border-soft bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-rust';
const smallLabel = 'mb-1 block text-[11px] uppercase tracking-wide text-ink-3';

// Full admin edit of an offer's fields (kovio_admin_update_offer).
function EditPanel({ offer, onDone }: { offer: AdminOffer; onDone: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState(offer.status);
  const [startAt, setStartAt] = useState(offer.start_at ?? '');
  const [endAt, setEndAt] = useState(offer.end_at ?? '');
  const [budgetUsd, setBudgetUsd] = useState((offer.budget_total_cents / 100).toString());
  const [timeWindow, setTimeWindow] = useState(offer.time_window ?? '');
  const [location, setLocation] = useState(offer.location_label ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_update_offer', {
      p_offer_id: offer.id,
      p_status: status !== offer.status ? status : null,
      p_start: startAt || null,
      p_end: endAt || null,
      p_budget_cents: Math.round(parseFloat(budgetUsd || '0') * 100),
      p_time_window: timeWindow.trim() || null,
      p_location: location.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message || 'Could not save.');
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div className="mt-3 rounded-md border border-border-soft bg-page p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className={smallLabel}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${smallInput} w-full`}>
            {['pending', 'accepted', 'rejected', 'countered'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={smallLabel}>Start</label>
          <DateField value={startAt} onChange={setStartAt} max={endAt || undefined} placeholder="Start" className={dateFieldSm} />
        </div>
        <div>
          <label className={smallLabel}>End</label>
          <DateField value={endAt} onChange={setEndAt} min={startAt || undefined} placeholder="End" className={dateFieldSm} />
        </div>
        <div>
          <label className={smallLabel}>Budget (USD)</label>
          <input type="number" min="0" step="1" value={budgetUsd} onChange={(e) => setBudgetUsd(e.target.value)} className={`${smallInput} w-full`} />
        </div>
        <div>
          <label className={smallLabel}>Time window</label>
          <input value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)} className={`${smallInput} w-full`} />
        </div>
        <div>
          <label className={smallLabel}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={`${smallInput} w-full`} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-md bg-rust px-4 py-1.5 text-sm text-page hover:bg-rust-dark disabled:opacity-50">
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button onClick={onDone} disabled={busy} className="rounded-md border border-border-soft px-4 py-1.5 text-sm text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Row({ offer, operators }: { offer: AdminOffer; operators: AdminOperator[] }) {
  const router = useRouter();
  const [target, setTarget] = useState(offer.target_oem_org_id ?? '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changed = target && target !== offer.target_oem_org_id;

  async function redirect() {
    if (!changed) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.rpc('kovio_admin_route_offer', { p_offer_id: offer.id, p_target_oem: target });
    setBusy(false);
    if (error) {
      setError(error.message || 'Could not redirect.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border-soft bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-black">
            {offer.creative_url ? (
              offer.creative_type === 'video' ? (
                <video src={offer.creative_url} muted className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={offer.creative_url} alt="" className="h-full w-full object-cover" />
              )
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{offer.name}</div>
            <div className="truncate text-xs text-ink-2">
              {offer.advertiser_name} · {usd(offer.budget_total_cents)} · {dateRange(offer.start_at, offer.end_at)}
              {offer.time_window ? ` · ${offer.time_window}` : ''}
            </div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[offer.status] ?? ''}`}>{offer.status}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
        <span className="text-xs text-ink-3">Route to</span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-md border border-border-soft bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-rust"
        >
          {operators.map((o) => (
            <option key={o.org_id} value={o.org_id}>
              {o.name}
              {o.accepting ? ' · accepting' : ''}
            </option>
          ))}
        </select>
        <button
          onClick={redirect}
          disabled={!changed || busy}
          className="rounded-md bg-rust px-3 py-1.5 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
        >
          {busy ? 'Redirecting…' : 'Redirect'}
        </button>
        <button
          onClick={() => setEditing((v) => !v)}
          className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-ink transition-colors hover:bg-page"
        >
          {editing ? 'Close edit' : 'Edit offer'}
        </button>
        {offer.target_oem_name && !changed && (
          <span className="text-xs text-ink-2">Currently with {offer.target_oem_name}</span>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      {editing && <EditPanel offer={offer} onDone={() => setEditing(false)} />}
    </div>
  );
}

export default function AdminOffers({
  offers,
  operators,
}: {
  offers: AdminOffer[];
  operators: AdminOperator[];
}) {
  if (offers.length === 0) {
    return <p className="text-sm text-ink-2">No incoming campaigns yet.</p>;
  }
  return (
    <div className="grid gap-3">
      {offers.map((o) => (
        <Row key={o.id} offer={o} operators={operators} />
      ))}
    </div>
  );
}
