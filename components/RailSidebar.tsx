'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type RailIcon =
  | 'overview'
  | 'campaigns'
  | 'fleets'
  | 'reports'
  | 'hawkeye'
  | 'billing'
  | 'displays'
  | 'settings';
export type RailItem = { label: string; href: string; count?: number; icon: RailIcon; live?: boolean };

// The mobile menu button (in AppShell's top bar) dispatches this event; the
// drawer below listens for it. Keeps the trigger and the drawer decoupled
// across the server/client boundary without a shared store.
export const MOBILE_NAV_OPEN_EVENT = 'kovio:nav-open';

// Hover label shown when the rail is collapsed. Lives inside a `group relative`
// parent; the dark popover slides in just past the rail's right edge.
function RailTip({ children }: { children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-[8px] border border-line-strong bg-ink px-2.5 py-1.5 text-[13px] font-medium text-bg opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
    >
      {children}
    </span>
  );
}

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
  if (name === 'displays') {
    // a screen with a play glyph — a looping display
    return (
      <svg {...common} aria-hidden="true">
        <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 21h6M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M10.8 8.4l3.4 2.1-3.4 2.1V8.4Z" fill="currentColor" />
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
  if (name === 'settings') {
    // sliders — campaign / account settings
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="16" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="10" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.7" />
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

// Shared nav list. `expanded` shows labels + counts; collapsed shows icon-only
// with hover tooltips (desktop rail) — the drawer is always expanded.
function NavLinks({
  items,
  pathname,
  expanded,
  tips,
  onNavigate,
}: {
  items: RailItem[];
  pathname: string;
  expanded: boolean;
  tips: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + '/');
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            aria-label={expanded ? undefined : it.label}
            className={`group relative flex items-center rounded-[10px] text-[17px] transition-colors ${
              expanded ? 'justify-between px-3 py-3' : 'justify-center px-0 py-3'
            } ${active ? 'bg-tint text-ink' : 'text-muted hover:bg-panel'}`}
          >
            <span className="flex items-center gap-3">
              <span className={`relative ${active ? 'text-accent' : ''}`}>
                <Icon name={it.icon} />
                {/* collapsed view loses the inline Live pill — keep a pulse dot */}
                {!expanded && it.live && (
                  <span className="k-pulse absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-good ring-2 ring-panel" />
                )}
              </span>
              {expanded && <span>{it.label}</span>}
            </span>
            {expanded && it.live && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-good">
                <span className="k-pulse h-1.5 w-1.5 rounded-full bg-good" />
                Live
              </span>
            )}
            {expanded && !it.live && typeof it.count === 'number' && (
              <span className="text-[15px] text-faint">{it.count}</span>
            )}
            {!expanded && tips && (
              <RailTip>
                {it.label}
                {it.live && <span className="ml-1.5 text-good">● Live</span>}
                {!it.live && typeof it.count === 'number' && (
                  <span className="ml-1.5 text-faint">{it.count}</span>
                )}
              </RailTip>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandHead({
  brand,
  kindLabel,
  initials,
  tileClass,
  expanded,
}: {
  brand: string;
  kindLabel: string;
  initials: string;
  tileClass: string;
  expanded: boolean;
}) {
  return (
    <div className={`mb-[34px] flex items-center gap-3.5 ${expanded ? '' : 'justify-center'}`}>
      <div
        className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[11px] font-mono text-[17px] text-white ${tileClass}`}
      >
        {initials}
      </div>
      {expanded && (
        <div className="min-w-0">
          <div className="truncate text-[18px] font-semibold text-ink">{brand}</div>
          <div className="text-[14px] text-muted">{kindLabel}</div>
        </div>
      )}
    </div>
  );
}

function Footer({
  expanded,
  dark,
  toggleTheme,
}: {
  expanded: boolean;
  dark: boolean;
  toggleTheme: () => void;
}) {
  return (
    <div className={`flex items-center ${expanded ? 'justify-between' : 'flex-col gap-2.5'}`}>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          aria-label="Sign out"
          className="group relative flex items-center gap-2.5 rounded-[10px] px-2 py-2 text-[15px] text-muted transition-colors hover:bg-panel hover:text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {expanded && <span>Sign out</span>}
          {!expanded && <RailTip>Sign out</RailTip>}
        </button>
      </form>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={dark}
        className="group relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong bg-panel text-[16px] text-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
        {!expanded && <RailTip>{dark ? 'Light mode' : 'Dark mode'}</RailTip>}
      </button>
    </div>
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem('kovio_rail') !== '0');
      setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    } catch {}
  }, []);

  // Open the drawer when AppShell's hamburger fires the event.
  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener(MOBILE_NAV_OPEN_EVENT, handler);
    return () => window.removeEventListener(MOBILE_NAV_OPEN_EVENT, handler);
  }, []);

  // Close the drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

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
    <>
      {/* Desktop rail — hidden on mobile (drawer takes over). */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-panel px-[18px] py-[26px] transition-[width] duration-200 ease-out lg:flex print:hidden"
        style={{ width: open ? 264 : 78 }}
      >
        {/* rail toggle — a little Kovio robot; its eyes glance toward where it'll
            go (left = collapse, right = expand) so the state stays legible. */}
        {/* fixed (not absolute) so the full circle floats over the main page
            instead of being clipped at the rail edge; tracks the rail width. */}
        <button
          type="button"
          onClick={toggleRail}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{ left: (open ? 264 : 78) - 16, top: 84 }}
          className="group fixed z-50 hidden h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-panel text-accent shadow-[0_2px_10px_rgba(0,0,0,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-white hover:shadow-[0_4px_14px_rgba(197,122,63,0.45)] lg:flex"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {/* antenna */}
            <circle cx="12" cy="3.4" r="1.15" className="fill-current group-hover:animate-none" />
            <line x1="12" y1="4.6" x2="12" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            {/* ears */}
            <line x1="3.4" y1="11" x2="3.4" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="20.6" y1="11" x2="20.6" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            {/* head */}
            <rect x="4.5" y="7" width="15" height="11.4" rx="3.4" stroke="currentColor" strokeWidth="1.7" />
            {/* eyes — pupils slide toward the action direction */}
            <circle cx={open ? 8 : 9.4} cy="12.1" r="1.35" fill="currentColor" />
            <circle cx={open ? 13.6 : 15} cy="12.1" r="1.35" fill="currentColor" />
            {/* mouth */}
            <path d="M9.6 15.5h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <BrandHead brand={brand} kindLabel={kindLabel} initials={initials} tileClass={tileClass} expanded={open} />

        {open && (
          <div className="mx-2 mb-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
            Workspace
          </div>
        )}

        <NavLinks items={items} pathname={pathname} expanded={open} tips />

        <div className="flex-1" />

        <Footer expanded={open} dark={dark} toggleTheme={toggleTheme} />
      </aside>

      {/* Mobile drawer + backdrop — only mounted below lg. */}
      <div className={`lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`} aria-hidden={!mobileOpen}>
        <div
          onClick={() => setMobileOpen(false)}
          className={`fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[280px] max-w-[84vw] flex-col border-r border-line bg-panel px-[18px] py-[22px] shadow-[0_0_40px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <BrandHead brand={brand} kindLabel={kindLabel} initials={initials} tileClass={tileClass} expanded />

          <div className="mx-2 mb-3.5 font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
            Workspace
          </div>

          <NavLinks
            items={items}
            pathname={pathname}
            expanded
            tips={false}
            onNavigate={() => setMobileOpen(false)}
          />

          <div className="flex-1" />

          <Footer expanded dark={dark} toggleTheme={toggleTheme} />
        </aside>
      </div>
    </>
  );
}
