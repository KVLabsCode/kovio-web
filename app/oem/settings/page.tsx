import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import OemSettingsForm from '@/components/OemSettingsForm';
import type { MyOemTerms } from '@/lib/offers';

// Fleet-operator settings: opt in to receiving custom campaigns and describe
// when/where your robots can run them.
export default async function OemSettingsPage() {
  const me = await api.oemMe();
  if (me.error?.status === 404) redirect('/oem/onboarding');
  if (me.error?.status === 403) redirect('/dashboard');

  const supabase = await createClient();
  const { data } = await supabase.rpc('kovio_get_my_oem_terms');
  const initial = ((Array.isArray(data) ? data[0] : data) as MyOemTerms | undefined) ?? null;

  return (
    <AppShell>
      <SectionHeader
        label="SETTINGS"
        greeting="Campaign settings."
        subtitle="Choose whether your fleet receives custom campaigns, and when and where they can run."
      />
      <div className="mt-8 max-w-3xl">
        <OemSettingsForm initial={initial} />
      </div>
    </AppShell>
  );
}
