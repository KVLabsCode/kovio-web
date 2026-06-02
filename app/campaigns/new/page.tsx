import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import NewCampaignForm from '@/components/NewCampaignForm';

export default function NewCampaignPage() {
  return (
    <AppShell>
      <SectionHeader
        label="CREATE CAMPAIGN"
        greeting="New campaign."
        subtitle="Set targeting, budget, and creative."
      />
      <div className="mt-8">
        <NewCampaignForm />
      </div>
    </AppShell>
  );
}
