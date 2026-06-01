'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/deposit', label: 'Deposit' },
];

export default function Header() {
  const pathname = usePathname();
  // Hide the chrome on auth screens.
  if (pathname === '/login' || pathname.startsWith('/auth')) return null;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-bold">
          Kovio
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                pathname.startsWith(n.href)
                  ? 'font-semibold underline'
                  : 'text-gray-600 hover:text-gray-900'
              }
            >
              {n.label}
            </Link>
          ))}
          <form action="/auth/logout" method="post">
            <button type="submit" className="text-gray-600 hover:text-gray-900">
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
