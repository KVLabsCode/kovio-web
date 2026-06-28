import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import CopyLinkButton from '@/components/CopyLinkButton';

const btnRust =
  'inline-flex items-center rounded-md bg-rust px-4 py-2.5 text-sm text-page transition-colors duration-200 hover:bg-rust-dark';

export default async function OemDisplaysPage() {
  const { data, error } = await api.oemDisplays();
  if (error?.status === 404) redirect('/oem/onboarding');
  if (error?.status === 403) redirect('/dashboard');
  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">
          Couldn’t load displays: {error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const displays = data.displays;

  return (
    <AppShell>
      <SectionHeader
        label="DISPLAYS"
        greeting="Custom displays."
        subtitle="Upload creative for your own advertisers, then point a robot screen at the link."
        rightActions={
          <Link href="/oem/displays/new" className={btnRust}>
            + New display
          </Link>
        }
      />

      <div className="mt-8">
        {displays.length === 0 ? (
          <div className="rounded-lg border border-border-soft bg-card p-10 text-center">
            <h3 className="font-serif text-h2 text-ink">No displays yet</h3>
            <p className="mx-auto mt-2 max-w-md text-ink-2">
              Create a display, upload your advertiser’s creative, and you’ll get a link you can
              open full-screen on any robot.
            </p>
            <Link href="/oem/displays/new" className={`${btnRust} mt-6`}>
              + New display
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {displays.map((d) => (
              <div key={d.id} className="flex flex-col rounded-lg border border-border-soft bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/oem/displays/${d.id}`} className="block truncate text-base text-ink hover:underline">
                      {d.name}
                    </Link>
                    <div className="mt-0.5 truncate text-sm text-ink-2">
                      {d.advertiser_name ?? '—'} · {d.item_count ?? 0} item
                      {(d.item_count ?? 0) === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                      d.status === 'active' ? 'bg-rust/10 text-rust' : 'border border-border-soft text-ink-2'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${d.status === 'active' ? 'bg-rust' : 'bg-ink-2'}`} />
                    {d.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                </div>

                <code className="mt-4 break-all rounded-md border border-border-soft bg-page px-2.5 py-2 text-xs text-ink-2">
                  {d.public_path}
                </code>

                <div className="mt-3 flex items-center gap-2">
                  <CopyLinkButton path={d.public_path} />
                  <a
                    href={d.public_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-border-soft px-3 py-2 text-sm text-ink transition-colors hover:bg-page"
                  >
                    Open
                  </a>
                  <Link
                    href={`/oem/displays/${d.id}`}
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
