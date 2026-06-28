import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import DisplayEditor from '@/components/DisplayEditor';

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ data, error }, fleetsRes] = await Promise.all([api.oemDisplay(id), api.oemFleets()]);
  if (error?.status === 404) redirect('/oem/campaigns');
  if (error?.status === 403) redirect('/dashboard');
  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">Couldn’t load this campaign.</p>
      </AppShell>
    );
  }
  const fleets = (fleetsRes.data?.fleets ?? []).map((f) => ({ id: f.id, name: f.name }));
  return (
    <AppShell>
      <DisplayEditor mode="edit" initial={data} fleets={fleets} />
    </AppShell>
  );
}
