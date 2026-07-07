import { redirect } from 'next/navigation';
import { redirectMissingOrg } from '@/lib/org-redirect';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import IncomingOffers from '@/components/IncomingOffers';
import type { IncomingOffer } from '@/lib/offers';

// The OEM Campaigns tab is the incoming-campaign inbox: advertiser campaigns
// routed to this fleet for review. (The operator's own "custom display" builder
// still exists at /oem/campaigns/new + /[id] but is no longer surfaced here, so
// incoming and custom aren't conflated.)
export default async function OemCampaignsPage() {
  // Reuse the existing onboarding / wrong-kind guards.
  const { error } = await api.oemDisplays();
  if (error?.status === 404) await redirectMissingOrg('oem');
  if (error?.status === 403) redirect('/dashboard');

  const supabase = await createClient();
  const { data: offerRows } = await supabase.rpc('kovio_oem_offers');
  const offers = (offerRows as IncomingOffer[]) ?? [];
  const pendingCount = offers.filter((o) => o.status === 'pending').length;

  return (
    <AppShell>
      <SectionHeader
        label="CAMPAIGNS"
        greeting="Incoming campaigns."
        subtitle={
          pendingCount > 0
            ? `You have ${pendingCount} campaign${pendingCount === 1 ? '' : 's'} awaiting review.`
            : 'Campaigns routed to your fleet for review.'
        }
      />

      <div className="mt-8">
        {offers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-soft p-10 text-center">
            <h3 className="font-serif text-h2 text-ink">No incoming campaigns yet</h3>
            <p className="mx-auto mt-2 max-w-md text-ink-2">
              When an advertiser’s campaign is routed to your fleet, it’ll appear here for you to accept
              or reject.
            </p>
          </div>
        ) : (
          <IncomingOffers offers={offers} />
        )}
      </div>
    </AppShell>
  );
}
