import { redirect } from 'next/navigation';

// Campaign creation is merged into one flow focused on the Robot.com fleet
// (/campaigns/place). This route sticks around so every existing "+ New
// campaign" link and bookmark keeps working. The old self-serve wizard
// (components/CampaignWizard.tsx) is parked, not deleted — restore this page's
// previous body to bring it back.
export default function NewCampaignPage() {
  redirect('/campaigns/place');
}
