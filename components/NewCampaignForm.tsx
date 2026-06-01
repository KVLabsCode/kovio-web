'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient, type CreateCampaignBody } from '@/lib/api-client';

const CATEGORIES = ['food', 'retail', 'brand', 'event', 'other'];

const PRESETS: Record<string, Record<string, unknown>> = {
  morning: { field: 'hour_of_day', op: 'between', value: [6, 11] },
  evening: { field: 'hour_of_day', op: 'between', value: [17, 21] },
  person_watching: { field: 'person_count', op: '>=', value: 1 },
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const inputCls =
  'w-full rounded-md border border-border-mid bg-card px-4 py-2.5 text-sm text-ink transition-colors focus:border-rust focus:outline-none';
const labelCls = 'mb-1.5 block text-sm text-ink-2';
const sectionCls = 'font-mono text-label uppercase text-ink-3';
const dividerCls = 'my-6 border-t border-dashed border-border-soft';

export default function NewCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [advertiser, setAdvertiser] = useState('');
  const [creativeUrl, setCreativeUrl] = useState('');
  const [category, setCategory] = useState('food');
  const [budgetUsd, setBudgetUsd] = useState('50');
  const [cpiCents, setCpiCents] = useState('10');
  const [cpaCents, setCpaCents] = useState('5');
  const [presets, setPresets] = useState<Record<string, boolean>>({
    morning: false,
    evening: false,
    person_watching: true,
  });
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const targeting = Object.entries(presets)
      .filter(([, on]) => on)
      .map(([key]) => PRESETS[key]);

    const body: CreateCampaignBody = {
      campaign_id: `${slugify(name) || 'campaign'}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      advertiser: advertiser || name,
      creative_url: creativeUrl,
      targeting,
      priority: 10,
      encounter_cap_seconds: 300,
      category,
      budget_total_cents: Math.round(parseFloat(budgetUsd || '0') * 100),
      cost_per_impression_cents: parseFloat(cpiCents || '0'),
      cost_per_attended_cents: parseFloat(cpaCents || '0'),
      start_at: startAt ? new Date(startAt).toISOString() : new Date().toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : null,
    };

    const { data, error } = await apiClient.createCampaign(body);
    if (error) {
      setLoading(false);
      if (error.code === 'insufficient_balance')
        setError('Not enough balance to cover this budget. Add funds first.');
      else if (error.code === 'campaign_id_taken')
        setError('A campaign with this ID already exists — try again.');
      else if (error.code === 'invalid_budget' || error.code === 'invalid_cost')
        setError(error.detail ?? 'Invalid budget or cost.');
      else setError(error.detail ?? 'Something went wrong.');
      return;
    }
    router.push(`/campaigns/${data!.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg border border-border-soft bg-card p-6">
      <div className={sectionCls}>Identity</div>
      <div className="mt-3 space-y-4">
        <div>
          <label className={labelCls}>Campaign name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Brand / advertiser</label>
          <input
            type="text"
            value={advertiser}
            onChange={(e) => setAdvertiser(e.target.value)}
            placeholder="Defaults to campaign name"
            className={inputCls}
          />
        </div>
      </div>

      <div className={dividerCls} />
      <div className={sectionCls}>Creative</div>
      <div className="mt-3">
        <label className={labelCls}>Creative URL</label>
        <input
          type="url"
          required
          value={creativeUrl}
          onChange={(e) => setCreativeUrl(e.target.value)}
          placeholder="https://…"
          className={inputCls}
        />
      </div>

      <div className={dividerCls} />
      <div className={sectionCls}>Targeting</div>
      <div className="mt-3 space-y-3">
        {[
          ['morning', 'Mornings (6–11am)'],
          ['evening', 'Evenings (5–9pm)'],
          ['person_watching', 'Person watching (≥1 person)'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={presets[key]}
              onChange={() => setPresets((p) => ({ ...p, [key]: !p[key] }))}
              className="accent-rust"
            />
            {label}
          </label>
        ))}
        <div>
          <label className={labelCls}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={dividerCls} />
      <div className={sectionCls}>Budget &amp; pricing</div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Total budget ($)</label>
          <input type="number" min="0.01" step="0.01" required value={budgetUsd} onChange={(e) => setBudgetUsd(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cost / impression (¢)</label>
          <input type="number" min="0.0001" step="0.0001" required value={cpiCents} onChange={(e) => setCpiCents(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cost / attended (¢)</label>
          <input type="number" min="0" step="0.0001" value={cpaCents} onChange={(e) => setCpaCents(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className={dividerCls} />
      <div className={sectionCls}>Schedule</div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Start</label>
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>End (optional)</label>
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className={dividerCls} />
      <div className="flex items-center justify-between">
        <Link href="/campaigns" className="text-sm text-ink-2 transition-colors hover:text-ink">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}
