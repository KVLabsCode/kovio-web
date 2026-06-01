import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { StatusPill } from '@/components/StatusPill';

export default async function CampaignsPage() {
  const { data, error } = await api.campaigns();
  if (error?.status === 404) redirect('/onboarding');
  if (error || !data) {
    return (
      <p className="text-sm text-red-600">
        Couldn’t load campaigns: {error?.detail ?? 'unknown error'}
      </p>
    );
  }

  const campaigns = data.campaigns;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Link
          href="/campaigns/new"
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-sm text-gray-500">
          No campaigns yet. Create your first one to start running ads on robots.
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Budget</th>
                <th className="px-4 py-2">Spent</th>
                <th className="px-4 py-2">Remaining</th>
                <th className="px-4 py-2">Cost / impr</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="px-4 py-2">{formatMoney(c.budget_total_cents)}</td>
                  <td className="px-4 py-2">{formatMoney(c.budget_spent_cents)}</td>
                  <td className="px-4 py-2">
                    {formatMoney(c.budget_total_cents - c.budget_spent_cents)}
                  </td>
                  <td className="px-4 py-2">{formatMoney(c.cost_per_impression_cents)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/campaigns/${c.id}`} className="text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
