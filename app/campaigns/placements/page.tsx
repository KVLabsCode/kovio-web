import AppShell from '@/components/AppShell';
import MyPlacements from '@/components/MyPlacements';
import { createClient } from '@/lib/supabase/server';
import type { MyOffer } from '@/lib/offers';

// Advertiser view of the custom campaigns they've placed with fleet operators,
// including any terms the operator adjusted (to confirm or decline).
export default async function PlacementsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('kovio_my_offers');
  const offers = (data as MyOffer[]) ?? [];
  const needsYou = offers.filter((o) => o.status === 'countered').length;

  return (
    <AppShell page="Placements">
      <div>
        <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-faint">CUSTOM CAMPAIGNS</p>
        <h1 className="my-[14px] mb-2 font-serif text-[54px] font-medium leading-none tracking-[-0.015em] text-ink">
          Placements.
        </h1>
        <p className="text-[19px] text-muted">
          {needsYou > 0
            ? `${needsYou} placement${needsYou === 1 ? '' : 's'} need your confirmation — an operator adjusted the terms.`
            : 'Custom campaigns you’ve placed with fleet operators, and their status.'}
        </p>
      </div>
      <MyPlacements offers={offers} />
    </AppShell>
  );
}
