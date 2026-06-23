import AppShell from '@/components/AppShell';
import { SectionHeader } from '@/components/SectionHeader';
import DepositForm from '@/components/DepositForm';

export default async function DepositPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <AppShell>
      <SectionHeader
        label="DEPOSIT FUNDS"
        greeting="Add funds."
        subtitle="Top up your balance via Stripe. Campaigns draw from it as they run."
      />

      {status === 'success' && (
        <div className="mt-8 max-w-md rounded-lg border border-good/40 bg-good/10 p-4">
          <div className="font-mono text-label uppercase text-good">Payment received</div>
          <p className="mt-1 text-sm text-good">
            Thanks! Your balance updates within a few seconds of Stripe confirming the payment.
          </p>
        </div>
      )}
      {status === 'cancel' && (
        <div className="mt-8 max-w-md rounded-lg border border-border-soft bg-card p-4">
          <div className="font-mono text-label uppercase text-ink-3">Checkout canceled</div>
          <p className="mt-1 text-sm text-ink-2">No charge was made. You can try again below.</p>
        </div>
      )}

      <div className="mt-6">
        <DepositForm />
      </div>
    </AppShell>
  );
}
