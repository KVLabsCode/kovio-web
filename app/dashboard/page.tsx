import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatMoney, formatRelative } from '@/lib/format';

export default async function DashboardPage() {
  const { data, error } = await api.dashboard();
  if (error?.status === 404) redirect('/onboarding');
  if (error || !data) {
    return (
      <p className="text-sm text-red-600">
        Couldn’t load your dashboard: {error?.detail ?? 'unknown error'}
      </p>
    );
  }

  const d = data;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            href="/campaigns/new"
            className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            New campaign
          </Link>
          <Link
            href="/deposit"
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium"
          >
            Add funds
          </Link>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label="Balance" value={formatMoney(d.balance_cents)} />
        <Card label="Active campaigns" value={String(d.active_campaigns)} />
        <Card label="Spent (30d)" value={formatMoney(d.spent_30d_cents)} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total campaigns" value={String(d.total_campaigns)} />
        <Stat label="Paused" value={String(d.paused_campaigns)} />
        <Stat label="Impressions (24h)" value={String(d.impressions_24h)} />
        <Stat label="Impressions (30d)" value={String(d.impressions_30d)} />
        <Stat label="Spent (24h)" value={formatMoney(d.spent_24h_cents)} />
      </div>

      {/* Recent impressions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent impressions</h2>
        {d.recent_impressions.length === 0 ? (
          <p className="text-sm text-gray-500">
            No impressions yet. Once robots play your ads, they’ll show up here.
          </p>
        ) : (
          <div className="overflow-hidden rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Campaign</th>
                  <th className="px-4 py-2">Cost</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {d.recent_impressions.map((imp, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2">{imp.campaign_name}</td>
                    <td className="px-4 py-2">{formatMoney(imp.cost_cents)}</td>
                    <td className="px-4 py-2 text-gray-500">{formatRelative(imp.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
