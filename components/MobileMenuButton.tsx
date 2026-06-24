'use client';

import { MOBILE_NAV_OPEN_EVENT } from './RailSidebar';

// Hamburger shown in the top bar below `lg`. Fires the event the RailSidebar
// drawer listens for — keeps the two decoupled across the server boundary.
export default function MobileMenuButton() {
  return (
    <button
      type="button"
      aria-label="Open menu"
      onClick={() => window.dispatchEvent(new CustomEvent(MOBILE_NAV_OPEN_EVENT))}
      className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line text-muted transition-colors hover:bg-panel hover:text-ink lg:hidden"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
