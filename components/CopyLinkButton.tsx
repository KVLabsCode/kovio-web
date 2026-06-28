'use client';

import { useState } from 'react';

// Copies an absolute URL (origin + path) to the clipboard. Used for the public
// /display/<code> link so an operator can paste it onto a robot screen.
export default function CopyLinkButton({
  path,
  label = 'Copy URL',
  className,
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        'inline-flex items-center rounded-md border border-border-soft px-3 py-2 text-sm text-ink transition-colors hover:bg-card'
      }
    >
      {done ? 'Copied!' : label}
    </button>
  );
}
