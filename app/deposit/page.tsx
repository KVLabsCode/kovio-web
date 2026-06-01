import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import DepositForm from '@/components/DepositForm';

export default function DepositPage() {
  return (
    <AppShell>
      <SectionHeader
        label="DEPOSIT FUNDS"
        greeting="Add funds."
        subtitle="Choose an amount to add to your balance."
      />

      <div className="mt-8 max-w-md rounded-lg border border-rust-soft bg-rust-soft/40 p-4">
        <div className="font-mono text-label uppercase text-rust-dark">Mock · not billed</div>
        <p className="mt-1 text-sm text-rust-dark">
          Real Stripe Checkout integration coming soon. For now, deposits credit your balance
          directly.
        </p>
      </div>

      <div className="mt-6">
        <DepositForm />
      </div>
    </AppShell>
  );
}
