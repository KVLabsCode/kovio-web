import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { StatusPill } from '@/components/StatusPill';
import PauseResumeButton from '@/components/PauseResumeButton';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // Next 16: params is async
  const { data, error } = await api.campaign(id);
  if (error?.status === 404) notFound();
  if (error || !data) {
    return (
      <p className="text-sm text-red-600">
        Couldn’t load campaign: {error?.detail ?? 'unknown error'}
      </p>
    );
  }

  const { campaign: c, stats } = data;
  const maxSpent = Math.max(1, ...stats.by_day.map((d) => d.spent_cents));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <StatusPill status={c.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {c.campaign_id} · {c.advertiser}
          </p>
        </div>
        <PauseResumeButton id={c.id} status={c.status} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card label="Budget" value={formatMoney(c.budget_total_cents)} />
        <Card label="Spent" value={formatMoney(stats.spent_cents_total)} />
        <Card label="Remaining" value={formatMoney(stats.remaining_cents)} />
        <Card label="Impressions" value={String(stats.impressions_total)} />
      </div>

      {/* By-day bar chart (plain divs) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Last 30 days</h2>
        {stats.by_day.length === 0 ? (
          <p className="text-sm text-gray-500">No impressions in the last 30 days.</p>
        ) : (
          <div className="space-y-1">
            {stats.by_day.map((d) => (
              <div key={d.date} className="flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0 text-gray-500">{d.date}</span>
                <div className="h-4 flex-1 rounded bg-gray-100">
                  <div
                    className="h-4 rounded bg-blue-500"
                    style={{ width: `${(d.spent_cents / maxSpent) * 100}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-gray-600">
                  {d.impressions} imp · {formatMoney(d.spent_cents)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full details */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Details</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Detail label="Creative URL" value={c.creative_url} />
          <Detail label="Category" value={c.category ?? '—'} />
          <Detail label="Priority" value={String(c.priority)} />
          <Detail label="Encounter cap" value={`${c.encounter_cap_seconds}s`} />
          <Detail label="Cost / impression" value={formatMoney(c.cost_per_impression_cents)} />
          <Detail label="Cost / attended" value={formatMoney(c.cost_per_attended_cents)} />
          <Detail label="Enabled" value={c.enabled ? 'Yes' : 'No'} />
          <Detail
            label="Targeting rules"
            value={c.targeting.length ? `${c.targeting.length} rule(s)` : 'None'}
          />
        </dl>
        {c.targeting.length > 0 && (
          <pre className="mt-3 overflow-x-auto rounded border border-gray-200 bg-white p-3 text-xs">
            {JSON.stringify(c.targeting, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1">
      <dt className="text-gray-500">{label}</dt>
      <dd className="ml-4 truncate font-medium">{value}</dd>
    </div>
  );
}
