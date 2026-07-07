import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KovioMark } from '@/components/KovioMark';
import AdminOffers, { type AdminOffer } from '@/components/AdminOffers';
import AdminOperators, { type AdminOperator } from '@/components/AdminOperators';
import AdminAdvertisers, { NewOrgControl, type AdminAdvertiserOrg } from '@/components/AdminAdvertisers';
import AdminUsers, { type AdminUserRow, type AdminOrg } from '@/components/AdminUsers';
import AdminAdmins from '@/components/AdminAdmins';
import { usd } from '@/lib/offers';

interface Overview {
  advertisers: number;
  operators: number;
  users_count: number;
  campaigns_count: number;
  offers_count: number;
  pending_offers: number;
  impressions_count: number;
}
interface AdminCampaign {
  name: string;
  advertiser: string;
  org_name: string | null;
  status: string;
  budget_total_cents: number;
  budget_spent_cents: number;
  created_at: string;
}

function SignOut() {
  return (
    <form action="/auth/logout" method="post">
      <button className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        Sign out
      </button>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border-soft bg-card p-4">
      <div className="font-mono text-[11px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-medium text-ink">{value}</div>
    </div>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: isAdmin } = await supabase.rpc('kovio_is_admin');
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-center">
        <div>
          <h1 className="font-serif text-h2 text-ink">Not authorized</h1>
          <p className="mt-2 text-ink-2">This area is restricted to Kovio administrators.</p>
          <div className="mt-6 flex justify-center">
            <SignOut />
          </div>
        </div>
      </div>
    );
  }

  const [ovRes, usersRes, campsRes, offersRes, opsRes, adminsRes, orgsRes, advsRes] = await Promise.all([
    supabase.rpc('kovio_admin_overview'),
    supabase.rpc('kovio_admin_users'),
    supabase.rpc('kovio_admin_campaigns'),
    supabase.rpc('kovio_admin_offers'),
    supabase.rpc('kovio_admin_operators'),
    supabase.rpc('kovio_admin_list_admins'),
    supabase.rpc('kovio_admin_orgs'),
    supabase.rpc('kovio_admin_advertisers'),
  ]);

  const ov = (Array.isArray(ovRes.data) ? ovRes.data[0] : ovRes.data) as Overview | undefined;
  const users = (usersRes.data as AdminUserRow[]) ?? [];
  const campaigns = (campsRes.data as AdminCampaign[]) ?? [];
  const offers = (offersRes.data as AdminOffer[]) ?? [];
  const operators = (opsRes.data as AdminOperator[]) ?? [];
  const admins = ((adminsRes.data as { email: string }[]) ?? []).map((a) => a.email);
  const orgs = (orgsRes.data as AdminOrg[]) ?? [];
  const advertiserOrgs = (advsRes.data as AdminAdvertiserOrg[]) ?? [];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-10 border-b border-border-soft bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-[11px]">
            <KovioMark className="h-5 w-5 text-accent" />
            <span className="font-mono text-[15px] tracking-[0.18em]">KOVIO</span>
            <span className="font-mono text-[11px] tracking-[0.14em] text-faint">/ ADMIN</span>
          </div>
          <SignOut />
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <h1 className="font-serif text-h1 text-ink">Control room.</h1>
        <p className="mt-1 text-ink-2">Everything happening across Kovio.</p>

        {/* Overview */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Advertisers" value={ov?.advertisers ?? 0} />
          <Stat label="Operators" value={ov?.operators ?? 0} />
          <Stat label="Users" value={ov?.users_count ?? 0} />
          <Stat label="Campaigns" value={ov?.campaigns_count ?? 0} />
          <Stat label="Offers" value={ov?.offers_count ?? 0} />
          <Stat label="Pending" value={ov?.pending_offers ?? 0} />
          <Stat label="Impressions" value={ov?.impressions_count ?? 0} />
        </div>

        {/* Incoming campaigns + redirect + edit */}
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-h2 text-ink">Incoming campaigns</h2>
          <p className="mb-4 text-sm text-ink-2">
            Redirect any campaign to Robot.com or another fleet operator, or edit its dates, budget and status directly.
          </p>
          <AdminOffers offers={offers} operators={operators} />
        </section>

        {/* Fleet operators + their settings */}
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-h2 text-ink">Fleet operators <span className="text-ink-3">({operators.length})</span></h2>
            <NewOrgControl kind="oem" label="+ New operator" />
          </div>
          <p className="mb-4 text-sm text-ink-2">
            Who’s accepting custom campaigns, full edit access to each operator’s settings, and claim links
            to hand accounts over.
          </p>
          <AdminOperators operators={operators} />
        </section>

        {/* Advertisers + claim links */}
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-h2 text-ink">Advertisers <span className="text-ink-3">({advertiserOrgs.length})</span></h2>
            <NewOrgControl kind="advertiser" label="+ New advertiser" />
          </div>
          <p className="mb-4 text-sm text-ink-2">
            Set up a brand (e.g. Pylon) and hand it over with a claim link — they sign in and get the
            advertiser dashboard ready to go.
          </p>
          <AdminAdvertisers advertisers={advertiserOrgs} />
        </section>

        {/* Admin allowlist */}
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-h2 text-ink">Kovio admins <span className="text-ink-3">({admins.length})</span></h2>
          <p className="mb-4 text-sm text-ink-2">Everyone with access to this control room.</p>
          <AdminAdmins admins={admins} myEmail={user.email ?? ''} />
        </section>

        {/* Users + org association */}
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-h2 text-ink">Users <span className="text-ink-3">({users.length})</span></h2>
          <p className="mb-4 text-sm text-ink-2">
            Associate any account with an organization — e.g. pick the account that acts for Robot.com,
            and it receives Robot.com’s incoming campaigns.
          </p>
          <AdminUsers users={users} orgs={orgs} />
        </section>

        {/* Campaigns */}
        <section className="mt-10">
          <h2 className="mb-3 font-serif text-h2 text-ink">Campaigns <span className="text-ink-3">({campaigns.length})</span></h2>
          <div className="overflow-x-auto rounded-lg border border-border-soft">
            <table className="w-full text-sm">
              <thead className="bg-card text-left text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-4 py-2.5">Advertiser</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Budget</th>
                  <th className="px-4 py-2.5">Spent</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i} className="border-t border-border-soft">
                    <td className="px-4 py-2.5 text-ink">{c.name}</td>
                    <td className="px-4 py-2.5 text-ink-2">{c.org_name ?? c.advertiser}</td>
                    <td className="px-4 py-2.5 text-ink-2">{c.status}</td>
                    <td className="px-4 py-2.5 text-ink-2">{usd(c.budget_total_cents)}</td>
                    <td className="px-4 py-2.5 text-ink-2">{usd(c.budget_spent_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
