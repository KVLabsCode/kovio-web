import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Staff accounts always land in the control room when no explicit
      // destination was requested — regardless of Google vs magic link, and
      // regardless of any org a view-as session left attached. Keeps admin
      // accounts out of advertiser/OEM onboarding and test-org dashboards.
      if (next === '/') {
        try {
          const { data: isAdmin } = await supabase.rpc('kovio_is_admin');
          if (isAdmin) return NextResponse.redirect(`${origin}/admin`);
        } catch {}
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
