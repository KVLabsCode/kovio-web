import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import DisplayEditor from '@/components/DisplayEditor';

export default async function NewCampaignPage() {
  // Fleets the operator can link this campaign to (so its robots serve it).
  const { data, error } = await api.oemFleets();
  if (error?.status === 404) redirect('/oem/onboarding');
  if (error?.status === 403) redirect('/dashboard');
  const fleets = (data?.fleets ?? []).map((f) => ({ id: f.id, name: f.name }));
  return (
    <AppShell>
      <DisplayEditor mode="create" fleets={fleets} />
    </AppShell>
  );
}
