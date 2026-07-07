import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';
import MyPlacements from '@/components/MyPlacements';
import type { MyOffer } from '@/lib/offers';

// The Campaigns page IS the placements list: every campaign submitted to the
// Robot.com fleet, with its review status, date-change confirmations and the
// comment thread. (The legacy engine-campaign table lives on in git history.)
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; payment?: string }>;
}) {
  const { paid, payment } = await searchParams;

  const me = await api.me();
  if (me.error?.status === 404) redirect('/onboarding');
  if (me.error?.status === 403 && me.error.code === 'wrong_user_kind') redirect('/oem/campaigns');

  const supabase = await createClient();
  const { data } = await supabase.rpc('kovio_my_offers');
  const offers = (data as MyOffer[]) ?? [];
  const needsYou = offers.filter((o) => o.status === 'countered').length;

  return (
    <AppShell page="Campaigns">
      <div className="mb-[34px] flex items-end justify-between">
        <div>
          <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-faint">CAMPAIGNS</p>
          <h1 className="my-[14px] mb-2 font-serif text-[54px] font-medium leading-none tracking-[-0.015em] text-ink">
            Campaigns.
          </h1>
          <p className="text-[19px] text-muted">
            {needsYou > 0
              ? `${needsYou} campaign${needsYou === 1 ? '' : 's'} need your confirmation — the operator proposed new dates.`
              : 'Your campaigns on the Robot.com fleet, and where each one stands.'}
          </p>
        </div>
        <Link
          href="/campaigns/place"
          className="inline-flex items-center rounded-[11px] bg-accent px-6 py-[14px] text-[16px] text-white transition-colors hover:bg-accent-dark"
        >
          + New campaign
        </Link>
      </div>

      {/* Stripe Checkout return banners */}
      {paid === '1' && (
        <div className="mb-6 rounded-[12px] border border-good/40 bg-good/10 px-4 py-3 text-[15px] text-good">
          Payment received — your campaign budget is funded. The operator will review your campaign shortly.
        </div>
      )}
      {payment === 'canceled' && (
        <div className="mb-6 rounded-[12px] border border-line-strong bg-panel px-4 py-3 text-[15px] text-muted">
          Payment canceled — no charge was made. Your campaign is still submitted; you can fund it when it’s
          approved.
        </div>
      )}

      <MyPlacements offers={offers} />
    </AppShell>
  );
}
