// The Kovio "rolling signal" mark. Inherits color via `currentColor` so callers
// set it with a text-* utility (e.g. text-accent) and it themes correctly.
export function KovioMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <path
        d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M4 4.4a11 11 0 0 0 0 15.2M20 4.4a11 11 0 0 1 0 15.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}
