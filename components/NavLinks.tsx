'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { label: string; href: string; count?: number };

export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + '/');
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors duration-200 ${
              active ? 'text-ink' : 'text-ink-2 hover:text-ink'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className={active ? 'text-rust' : 'text-ink-3'}>{active ? '●' : '○'}</span>
              {it.label}
            </span>
            {typeof it.count === 'number' && (
              <span className="text-xs text-ink-3">{it.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
