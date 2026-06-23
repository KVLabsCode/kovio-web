import { redirect } from 'next/navigation';

// Renamed to Insights. Keep this route as a redirect so old links/bookmarks work.
export default async function ReportsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  redirect(campaign ? `/insights?campaign=${campaign}` : '/insights');
}
