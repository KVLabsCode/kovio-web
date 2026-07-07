import { redirect } from 'next/navigation';

// The deposit/top-up model is retired — campaigns are priced upfront and paid
// via Stripe at submission. Old links land on Billing.
export default function DepositPage() {
  redirect('/billing');
}
