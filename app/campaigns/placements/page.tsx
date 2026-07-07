import { redirect } from 'next/navigation';

// Placements merged into the Campaigns page itself. This route survives so
// notification emails and old links keep working.
export default function PlacementsPage() {
  redirect('/campaigns');
}
