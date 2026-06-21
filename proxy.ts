// Next.js 16 renamed the `middleware` convention to `proxy`. Same behavior:
// runs on the server before routes render — here it gates auth.
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// `/r/` (tracked QR redirects) and `/creative/` (fleet-rendered ad creatives)
// are reached by unauthenticated robots and phone scanners — they must stay public.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/confirm', '/r/', '/creative/'];

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
