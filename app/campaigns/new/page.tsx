import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import CampaignWizard from '@/components/CampaignWizard';

export default async function NewCampaignPage() {
  const { data, error } = await api.campaigns();
  if (error?.status === 404) redirect('/onboarding');
  // The free (default-setup) campaign is offered only until the first campaign
  // exists; after that it's custom (paid) campaigns only.
  const trialAvailable = (data?.campaigns.length ?? 0) === 0;
  return <CampaignWizard trialAvailable={trialAvailable} />;
}
