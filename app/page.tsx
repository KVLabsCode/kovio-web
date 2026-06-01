import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export default async function Home() {
  const { data, error } = await api.me();

  if (error?.status === 404) redirect('/onboarding');
  if (!error && data) redirect('/dashboard');

  // We have a Supabase session (the proxy let us reach here) but the API
  // rejected it — almost always a backend JWT-secret mismatch — or is
  // unreachable. Do NOT redirect to /login here: the proxy bounces an
  // authenticated user /login → / which would create an infinite loop
  // (ERR_TOO_MANY_REDIRECTS). Show an escape hatch instead.
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Can’t load your account</h1>
      <p className="text-sm text-gray-600">
        You’re signed in, but the Kovio API rejected your session
        {error?.status
          ? ` (HTTP ${error.status}${error.code ? ` · ${error.code}` : ''})`
          : ''}
        . This is almost always a server configuration issue (JWT secret), not
        your account. Try again shortly, or sign out and back in.
      </p>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
