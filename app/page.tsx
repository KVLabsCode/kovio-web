import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export default async function Home() {
  const { data, error } = await api.me();

  // Not onboarded yet → send to onboarding.
  if (error?.status === 404) redirect('/onboarding');
  // No session / other error → middleware (proxy) normally catches this; be safe.
  if (error || !data) redirect('/login');

  redirect('/dashboard');
}
