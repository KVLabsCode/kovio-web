import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import NewFleetForm from '@/components/NewFleetForm';

export default function NewFleetPage() {
  return (
    <AppShell>
      <SectionHeader
        label="CREATE FLEET"
        greeting="New fleet."
        subtitle="A fleet is a group of robots you operate together."
      />
      <div className="mt-8">
        <NewFleetForm />
      </div>
    </AppShell>
  );
}
