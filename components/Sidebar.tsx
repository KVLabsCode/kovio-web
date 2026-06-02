import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import NavLinks, { type NavItem } from './NavLinks';

// Kind-aware sidebar: advertiser by default; if /me reports a wrong_user_kind
// (the caller is an OEM), fall through to the OEM identity + nav. Renders
// nothing if the user isn't onboarded (AppShell handles the no-sidebar case).
export default async function Sidebar() {
  const me = await api.me();

  if (me.data) {
    return <AdvertiserSidebar org={me.data.org} />;
  }
  if (me.error?.status === 403 && me.error.code === 'wrong_user_kind') {
    const oem = await api.oemMe();
    if (oem.data) return <OemSidebar org={oem.data.org} />;
  }
  return null;
}

function Shell({
  name,
  kindLabel,
  avatarBg,
  items,
  footer,
}: {
  name: string;
  kindLabel: string;
  avatarBg: string;
  items: NavItem[];
  footer: React.ReactNode;
}) {
  const initials =
    name.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'KO';
  return (
    <aside className="sticky top-0 flex h-screen w-[280px] shrink-0 flex-col overflow-y-auto border-r border-border-soft bg-page p-6">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-lg font-mono text-xl text-ink ${avatarBg}`}
        >
          {initials}
        </div>
        <div>
          <div className="text-sm font-medium text-ink">{name}</div>
          <div className="text-xs text-ink-3">{kindLabel}</div>
        </div>
      </div>

      <div className="mt-6 font-mono text-label uppercase text-ink-3">Workspace</div>
      <div className="mt-3">
        <NavLinks items={items} />
      </div>

      <div className="flex-grow" />
      {footer}

      <form action="/auth/logout" method="post" className="mt-4">
        <button type="submit" className="text-xs text-ink-3 transition-colors hover:text-ink">
          Sign out
        </button>
      </form>
    </aside>
  );
}

async function AdvertiserSidebar({
  org,
}: {
  org: { name: string; balance_cents: number };
}) {
  const dash = await api.dashboard();
  const balance = org.balance_cents ?? 0;
  const spent = dash.data?.spent_30d_cents ?? 0;
  const funds = balance + spent;
  const spentPct = funds > 0 ? Math.round((spent / funds) * 100) : 0;

  const items: NavItem[] = [
    { label: 'Overview', href: '/dashboard' },
    { label: 'Campaigns', href: '/campaigns', count: dash.data?.total_campaigns },
    { label: 'Deposit', href: '/deposit' },
  ];

  const footer = (
    <div className="rounded-lg border border-border-soft bg-card p-4">
      <div className="font-mono text-label uppercase text-ink-3">Bid balance</div>
      <div className="mt-1 font-serif text-h2 text-ink">{formatMoney(balance)}</div>
      <div className="mt-2 h-1 w-full rounded-full bg-rust-soft">
        <div className="h-1 rounded-full bg-rust" style={{ width: `${Math.min(100, spentPct)}%` }} />
      </div>
      <div className="mt-2 text-xs text-ink-3">
        {formatMoney(spent)} spent · {spentPct}%
      </div>
    </div>
  );

  return (
    <Shell name={org.name} kindLabel="Advertiser" avatarBg="bg-rust" items={items} footer={footer} />
  );
}

async function OemSidebar({
  org,
}: {
  org: { name: string; pending_payout_cents: number; lifetime_payout_cents: number };
}) {
  const dash = await api.oemDashboard();

  const items: NavItem[] = [
    { label: 'Overview', href: '/oem/dashboard' },
    { label: 'Fleets', href: '/oem/fleets', count: dash.data?.total_fleets },
  ];

  const footer = (
    <div className="rounded-lg border border-border-soft bg-card p-4">
      <div className="font-mono text-label uppercase text-ink-3">Pending payout</div>
      <div className="mt-1 font-serif text-h2 text-ink">
        {formatMoney(org.pending_payout_cents)}
      </div>
      <div className="mt-2 text-xs text-ink-3">
        lifetime · {formatMoney(org.lifetime_payout_cents)}
      </div>
    </div>
  );

  return (
    <Shell name={org.name} kindLabel="OEM" avatarBg="bg-navy" items={items} footer={footer} />
  );
}
