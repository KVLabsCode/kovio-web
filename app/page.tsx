import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { api } from '@/lib/api';

export default async function Home() {
  const { data, error } = await api.me();

  if (!error && data) redirect('/dashboard');
  // An OEM hitting the advertiser /me → route to the OEM dashboard.
  if (error?.status === 403 && error.code === 'wrong_user_kind') redirect('/oem/dashboard');
  // Not onboarded yet: fleet operators → OEM onboarding, everyone else →
  // advertiser onboarding. The intent cookie (set by /oem/login) survives even
  // when Supabase falls back to the Site URL and drops the redirect's ?next=.
  if (error?.status === 404) {
    const kind = (await cookies()).get('kovio_onboard_kind')?.value;
    redirect(kind === 'oem' ? '/oem/onboarding' : '/onboarding');
  }

  // Authenticated (proxy let us through) but the API rejected the session.
  // Render an error rather than redirect to /login, which would loop with the proxy.
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="font-mono text-xs uppercase tracking-wider text-ink-3">Kovio</div>
        <h1 className="mt-6 font-serif text-h2 text-ink">Can’t load your account</h1>
        <p className="mt-2 text-sm text-ink-2">
          You’re signed in, but the Kovio API rejected your session
          {error?.status ? ` (HTTP ${error.status}${error.code ? ` · ${error.code}` : ''})` : ''}.
          This is almost always a server configuration issue, not your account.
        </p>
        <form action="/auth/logout" method="post" className="mt-4">
          <button
            type="submit"
            className="rounded-md border border-border-soft px-4 py-2.5 text-sm text-ink-2 transition-colors hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
