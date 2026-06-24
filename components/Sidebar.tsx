import { api } from '@/lib/api';
import RailSidebar, { type RailItem } from './RailSidebar';

function initialsOf(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'AD';
}

// Kind-aware sidebar: advertiser by default; if /me reports a wrong_user_kind
// (the caller is an OEM), fall through to the OEM identity + nav. Renders
// nothing if the user isn't onboarded (AppShell handles the no-sidebar case).
export default async function Sidebar() {
  const me = await api.me();

  if (me.data) {
    const dash = await api.dashboard();
    // Hawkeye lives inside each campaign (/campaigns/[id]) now — no standalone
    // nav tab. See the campaign detail page for the live view.
    const items: RailItem[] = [
      { label: 'Overview', href: '/dashboard', icon: 'overview' },
      { label: 'Campaigns', href: '/campaigns', icon: 'campaigns', count: dash.data?.total_campaigns },
      { label: 'Insights', href: '/insights', icon: 'reports' },
      { label: 'Billing', href: '/billing', icon: 'billing' },
    ];
    return (
      <RailSidebar
        brand={me.data.org.name}
        kindLabel="Advertiser"
        initials={initialsOf(me.data.org.name)}
        tileClass="bg-accent"
        items={items}
      />
    );
  }

  if (me.error?.status === 403 && me.error.code === 'wrong_user_kind') {
    const oem = await api.oemMe();
    if (oem.data) {
      const dash = await api.oemDashboard();
      const items: RailItem[] = [
        { label: 'Overview', href: '/oem/dashboard', icon: 'overview' },
        { label: 'Fleets', href: '/oem/fleets', icon: 'fleets', count: dash.data?.total_fleets },
      ];
      return (
        <RailSidebar
          brand={oem.data.org.name}
          kindLabel="Fleet operator"
          initials={initialsOf(oem.data.org.name)}
          tileClass="bg-navy"
          items={items}
        />
      );
    }
  }

  return null;
}
