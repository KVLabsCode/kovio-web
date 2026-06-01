'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, type CreateCampaignBody } from '@/lib/api-client';

const CATEGORIES = ['food', 'retail', 'brand', 'event', 'other'];

// Targeting presets → rule objects the backend stores verbatim.
const PRESETS: Record<string, Record<string, unknown>> = {
  morning: { field: 'hour_of_day', op: 'between', value: [6, 11] },
  evening: { field: 'hour_of_day', op: 'between', value: [17, 21] },
  person_watching: { field: 'person_count', op: '>=', value: 1 },
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [advertiser, setAdvertiser] = useState('');
  const [creativeUrl, setCreativeUrl] = useState('');
  const [category, setCategory] = useState('food');
  const [priority, setPriority] = useState(10);
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

  function togglePreset(key: string) {
    setPresets((p) => ({ ...p, [key]: !p[key] }));
  }

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
      priority,
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
      if (error.code === 'insufficient_balance') {
        setError('Not enough balance to cover this budget. Add funds first.');
      } else if (error.code === 'campaign_id_taken') {
        setError('A campaign with this ID already exists — try again.');
      } else if (error.code === 'invalid_budget' || error.code === 'invalid_cost') {
        setError(error.detail ?? 'Invalid budget or cost.');
      } else {
        setError(error.detail ?? 'Something went wrong.');
      }
      return;
    }
    router.push(`/campaigns/${data!.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">New campaign</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Campaign name">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Advertiser (display name)">
          <input
            type="text"
            value={advertiser}
            onChange={(e) => setAdvertiser(e.target.value)}
            placeholder="Defaults to campaign name"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Creative URL">
          <input
            type="url"
            required
            value={creativeUrl}
            onChange={(e) => setCreativeUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Priority: ${priority}`}>
          <input
            type="range"
            min={1}
            max={100}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Budget (USD)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Cost / impression (¢)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={cpiCents}
              onChange={(e) => setCpiCents(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Cost / attended (¢)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={cpaCents}
              onChange={(e) => setCpaCents(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <fieldset className="rounded border border-gray-200 p-3">
          <legend className="px-1 text-sm font-medium">Targeting presets</legend>
          {[
            ['morning', 'Morning (6–11am)'],
            ['evening', 'Evening (5–9pm)'],
            ['person_watching', 'Person watching (≥1 person)'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={presets[key]}
                onChange={() => togglePreset(key)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start (optional)">
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="End (optional)">
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create campaign'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
