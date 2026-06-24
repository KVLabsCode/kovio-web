import { redirect } from 'next/navigation';

// Hawkeye was consolidated into the campaign detail page (/campaigns/[id]).
// The standalone page (just a campaign picker over the live tile) is gone;
// redirect any old links/bookmarks to the campaigns list.
export default function HawkeyePage() {
  redirect('/campaigns');
}
