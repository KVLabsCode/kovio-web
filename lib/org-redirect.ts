import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Where to send a signed-in user whose account has no org (backend 404
// not_onboarded). Admins ALWAYS go back to the control room — an org-less
// admin (e.g. after a view-as session ends) must never be dumped into
// onboarding. Everyone else goes to the right onboarding for the surface.
export async function redirectMissingOrg(kind: 'oem' | 'advertiser'): Promise<never> {
  let isAdmin = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc('kovio_is_admin');
    isAdmin = !!data;
  } catch {}
  redirect(isAdmin ? '/admin' : kind === 'oem' ? '/oem/onboarding' : '/onboarding');
}
