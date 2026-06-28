import AppShell from '@/components/AppShell';
import DisplayEditor from '@/components/DisplayEditor';

export default function NewDisplayPage() {
  return (
    <AppShell>
      <DisplayEditor mode="create" />
    </AppShell>
  );
}
