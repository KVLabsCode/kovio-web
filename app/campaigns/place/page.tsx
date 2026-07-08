import AppShell from '@/components/AppShell';
import PlaceCampaignForm from '@/components/PlaceCampaignForm';

// Advertiser flow: place a custom campaign with a specific fleet operator, who
// reviews and accepts/rejects it. A server shell + client island (the form talks
// to Supabase RPCs and POSTs to /api/offers/place).
export default function PlaceCampaignPage() {
  return (
    <AppShell page="New campaign">
      <div>
        <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-faint">NEW CAMPAIGN</p>
        <h1 className="my-[14px] mb-2 font-serif text-[54px] font-medium leading-none tracking-[-0.015em] text-ink">
          New campaign.
        </h1>
        <p className="text-[19px] text-muted">
          Launch your creative on a robot fleet. The operator reviews the content, and it runs on
          real robots once approved.
        </p>
      </div>
      <PlaceCampaignForm />
    </AppShell>
  );
}
