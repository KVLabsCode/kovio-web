import AppShell from '@/components/AppShell';
import PlaceCampaignForm from '@/components/PlaceCampaignForm';

// Advertiser flow: place a custom campaign with a specific fleet operator, who
// reviews and accepts/rejects it. A server shell + client island (the form talks
// to Supabase RPCs and POSTs to /api/offers/place).
export default function PlaceCampaignPage() {
  return (
    <AppShell page="Place with a fleet">
      <div>
        <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-faint">CUSTOM CAMPAIGN</p>
        <h1 className="my-[14px] mb-2 font-serif text-[54px] font-medium leading-none tracking-[-0.015em] text-ink">
          Place with a fleet.
        </h1>
        <p className="text-[19px] text-muted">
          Send a campaign to a fleet operator for approval. They review the content and decide whether
          it runs on their robots.
        </p>
      </div>
      <PlaceCampaignForm />
    </AppShell>
  );
}
