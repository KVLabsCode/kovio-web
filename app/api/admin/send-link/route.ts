// POST /api/admin/send-link — locked admin sign-in. A magic link is only sent
// when the email is on the admin allowlist; the response is identical either
// way so the form can't be used to probe who's an admin. (The /admin page
// itself re-checks kovio_is_admin after sign-in — this is the outer lock.)

import { createClient } from '@/lib/supabase/server';

function origin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  let email = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('kovio_is_admin_email', { p_email: email });

  if (allowed) {
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin(request)}/auth/callback?next=${encodeURIComponent('/admin')}`,
        shouldCreateUser: true,
      },
    });
  }

  // Same answer whether or not the email is allowlisted.
  return Response.json({ ok: true });
}
