'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OfferComment } from '@/lib/offers';

const ROLE_LABEL: Record<string, string> = {
  advertiser: 'Advertiser',
  operator: 'Fleet operator',
  kovio: 'Kovio',
};

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Collapsible comment thread on an offer, shared by the OEM inbox and the
// advertiser placements view. Lazy: comments load on first expand.
export default function OfferComments({ offerId }: { offerId: string }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<OfferComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.rpc('kovio_offer_comments', { p_offer_id: offerId });
    setComments((data as OfferComment[]) ?? []);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && comments === null) void load();
  }

  async function post() {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    setError('');
    const res = await fetch('/api/offers/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId, body: text }),
    });
    const json = await res.json().catch(() => ({}));
    setPosting(false);
    if (!res.ok) {
      setError(json.error ?? 'Could not post the comment.');
      return;
    }
    setDraft('');
    await load();
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        className="text-sm text-ink-2 transition-colors hover:text-ink"
        aria-expanded={open}
      >
        💬 Comments{comments !== null ? ` (${comments.length})` : ''} {open ? '▴' : '▾'}
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border-soft bg-page p-3">
          {comments === null ? (
            <p className="text-sm text-ink-3">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-ink-3">No comments yet — start the conversation.</p>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className={`max-w-[85%] ${c.is_me ? 'ml-auto' : ''}`}>
                  <div className={`rounded-lg px-3 py-2 text-sm ${c.is_me ? 'bg-rust/10 text-ink' : 'border border-border-soft bg-card text-ink'}`}>
                    {c.body}
                  </div>
                  <div className={`mt-0.5 text-[11px] text-ink-3 ${c.is_me ? 'text-right' : ''}`}>
                    {c.is_me ? 'You' : ROLE_LABEL[c.author_role] ?? c.author_role} · {when(c.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void post();
                }
              }}
              placeholder="Write a comment…"
              className="flex-1 rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust"
            />
            <button
              type="button"
              onClick={post}
              disabled={posting || !draft.trim()}
              className="rounded-md bg-rust px-4 py-2 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
            >
              {posting ? '…' : 'Send'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
