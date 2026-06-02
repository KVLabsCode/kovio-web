import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import NavLinks, { type NavItem } from './NavLinks';

export default async function Sidebar() {
  const [me, dash] = await Promise.all([api.me(), api.dashboard()]);
  const org = me.data?.org;
  const slug = org?.slug ?? 'kovio';
  const initials = slug.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'KO';
  const balance = org?.balance_cents ?? 0;
  const spent = dash.data?.spent_30d_cents ?? 0;
  const totalCampaigns = dash.data?.total_campaigns;
  const funds = balance + spent;
  const spentPct = funds > 0 ? Math.round((spent / funds) * 100) : 0;

  const items: NavItem[] = [
    { label: 'Overview', href: '/dashboard' },
    { label: 'Campaigns', href: '/campaigns', count: totalCampaigns },
    { label: 'Deposit', href: '/deposit' },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-[280px] shrink-0 flex-col overflow-y-auto border-r border-border-soft bg-page p-6">
      {/* Brand card */}
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-rust font-mono text-xl text-ink">
          {initials}
        </div>
        <div>
          <div className="text-sm font-medium text-ink">{org?.name ?? 'Kovio'}</div>
          <div className="text-xs text-ink-3">Advertiser</div>
        </div>
      </div>

      <div className="mt-6 font-mono text-label uppercase text-ink-3">Workspace</div>
      <div className="mt-3">
        <NavLinks items={items} />
      </div>

      <div className="flex-grow" />

      {/* Bid balance card */}
      <div className="rounded-lg border border-border-soft bg-card p-4">
        <div className="font-mono text-label uppercase text-ink-3">Bid balance</div>
        <div className="mt-1 font-serif text-h2 text-ink">{formatMoney(balance)}</div>
        <div className="mt-2 h-1 w-full rounded-full bg-rust-soft">
          <div
            className="h-1 rounded-full bg-rust"
            style={{ width: `${Math.min(100, spentPct)}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-ink-3">
          {formatMoney(spent)} spent · {spentPct}%
        </div>
      </div>

      <form action="/auth/logout" method="post" className="mt-4">
        <button type="submit" className="text-xs text-ink-3 transition-colors hover:text-ink">
          Sign out
        </button>
      </form>
    </aside>
  );
}
