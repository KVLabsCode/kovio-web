'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type RailIcon = 'overview' | 'campaigns' | 'fleets' | 'reports' | 'hawkeye' | 'billing';
export type RailItem = { label: string; href: string; count?: number; icon: RailIcon; live?: boolean };

function Icon({ name }: { name: RailIcon }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' as const };
  if (name === 'overview') {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
        <rect x="14" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
        <rect x="14" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (name === 'billing') {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (name === 'hawkeye') {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'reports') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M5 19V5a1 1 0 0 1 1-1h9l4 4v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'fleets') {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="3" y="9" width="13" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M16 12h3l2 3v3h-5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="7" cy="18.5" r="1.7" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="17" cy="18.5" r="1.7" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  // campaigns — broadcast / signal
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 6.5a7.5 7.5 0 0 0 0 11M17.5 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3.7 3.7a11.6 11.6 0 0 0 0 16.6M20.3 3.7a11.6 11.6 0 0 1 0 16.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export default function RailSidebar({
  brand,
  kindLabel,
  initials,
  tileClass,
  items,
}: {
  brand: string;
  kindLabel: string;
  initials: string;
  tileClass: string;
  items: RailItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem('kovio_rail') !== '0');
      setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    } catch {}
  }, []);

  function toggleRail() {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem('kovio_rail', next ? '1' : '0');
      } catch {}
      return next;
    });
  }

  function toggleTheme() {
    setDark((v) => {
      const next = !v;
      const theme = next ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('kovio_theme', theme);
      } catch {}
      return next;
    });
  }

  return (
    <aside
      className="sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-panel px-[18px] py-[26px] transition-[width] duration-200 ease-out print:hidden"
      style={{ width: open ? 264 : 78 }}
    >
      {/* rail toggle */}
      <button
        type="button"
        onClick={toggleRail}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        className="absolute right-[-13px] top-[30px] z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line-strong bg-panel text-[13px] text-muted transition-colors hover:border-accent hover:bg-accent hover:text-white"
      >
        {open ? '‹' : '›'}
      </button>

      {/* brand head */}
      <div className={`mb-[34px] flex items-center gap-3.5 ${open ? '' : 'justify-center'}`}>
        <div
          className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[11px] font-mono text-[17px] text-white ${tileClass}`}
        >
          {initials}
        </div>
        {open && (
          <div className="min-w-0">
            <div className="truncate text-[18px] font-semibold text-ink">{brand}</div>
            <div className="text-[14px] text-muted">{kindLabel}</div>
          </div>
        )}
      </div>

      {open && (
        <div className="mx-2 mb-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
          Workspace
        </div>
      )}

      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/');
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              className={`group flex items-center rounded-[10px] text-[17px] transition-colors ${
                open ? 'justify-between px-3 py-3' : 'justify-center px-0 py-3'
              } ${active ? 'bg-tint text-ink' : 'text-muted hover:bg-panel'}`}
            >
              <span className="flex items-center gap-3">
                <span className={active ? 'text-accent' : ''}>
                  <Icon name={it.icon} />
                </span>
                {open && <span>{it.label}</span>}
              </span>
              {open && it.live && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-good">
                  <span className="k-pulse h-1.5 w-1.5 rounded-full bg-good" />
                  Live
                </span>
              )}
              {open && !it.live && typeof it.count === 'number' && (
                <span className="text-[15px] text-faint">{it.count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className={`flex items-center ${open ? 'justify-between' : 'flex-col gap-2.5'}`}>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            title="Sign out"
            className="flex items-center gap-2.5 rounded-[10px] px-2 py-2 text-[15px] text-muted transition-colors hover:bg-panel hover:text-ink"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {open && <span>Sign out</span>}
          </button>
        </form>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong bg-panel text-[16px] text-muted transition-colors hover:text-ink"
        >
          {dark ? '☀' : '☾'}
        </button>
      </div>
    </aside>
  );
}
