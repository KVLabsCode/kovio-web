import ClaimClient from '@/components/ClaimClient';

// Public landing for operator account-claim links (emailed by an admin).
// The client handles: sign-in with the invited email, then the claim RPC.
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClaimClient token={token} />;
}
