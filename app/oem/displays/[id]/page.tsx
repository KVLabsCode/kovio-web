import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import DisplayEditor from '@/components/DisplayEditor';

export default async function EditDisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, error } = await api.oemDisplay(id);
  if (error?.status === 404) redirect('/oem/displays');
  if (error?.status === 403) redirect('/dashboard');
  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">Couldn’t load this display.</p>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <DisplayEditor mode="edit" initial={data} />
    </AppShell>
  );
}
