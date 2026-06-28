import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import CopyLinkButton from '@/components/CopyLinkButton';

const btnRust =
  'inline-flex items-center rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark';

export default async function OemCampaignsPage() {
  const { data, error } = await api.oemDisplays();
  if (error?.status === 404) redirect('/oem/onboarding');
  if (error?.status === 403) redirect('/dashboard');
  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">
          Couldn’t load campaigns: {error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const campaigns = data.displays;

  return (
    <AppShell>
      <SectionHeader
        label="CAMPAIGNS"
        greeting="Custom campaigns."
        subtitle="Run your own advertisers’ creative on your robots, and point any screen at the link."
        rightActions={
          <Link href="/oem/campaigns/new" className={btnRust}>
            + New campaign
          </Link>
        }
      />

      <div className="mt-8">
        {campaigns.length === 0 ? (
          <div className="rounded-lg border border-border-soft bg-card p-10 text-center">
            <h3 className="font-serif text-h2 text-ink">No campaigns yet</h3>
            <p className="mx-auto mt-2 max-w-md text-ink-2">
              Create a campaign, upload your advertiser’s creative, optionally link it to a fleet,
              and you’ll get a link you can open full-screen on any robot.
            </p>
            <Link href="/oem/campaigns/new" className={`${btnRust} mt-6`}>
              + New campaign
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {campaigns.map((c) => (
              <div key={c.id} className="flex flex-col rounded-lg border border-border-soft bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/oem/campaigns/${c.id}`} className="block truncate text-base text-ink hover:underline">
                      {c.name}
                    </Link>
                    <div className="mt-0.5 truncate text-sm text-ink-2">
                      {c.advertiser_name ?? '—'} · {c.item_count ?? 0} item
                      {(c.item_count ?? 0) === 1 ? '' : 's'}
                      {c.fleet_id ? ' · fleet-linked' : ''}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                      c.status === 'active' ? 'bg-rust/10 text-rust' : 'border border-border-soft text-ink-2'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${c.status === 'active' ? 'bg-rust' : 'bg-ink-2'}`} />
                    {c.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                </div>

                <code className="mt-4 break-all rounded-md border border-border-soft bg-page px-2.5 py-2 text-xs text-ink-2">
                  {c.public_path}
                </code>

                <div className="mt-3 flex items-center gap-2">
                  <CopyLinkButton path={c.public_path} />
                  <a
                    href={c.public_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-border-soft px-3 py-2 text-sm text-ink transition-colors hover:bg-page"
                  >
                    Open
                  </a>
                  <Link
                    href={`/oem/campaigns/${c.id}`}
                    className="ml-auto inline-flex items-center rounded-md border border-border-soft px-3 py-2 text-sm text-ink transition-colors hover:bg-page"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
