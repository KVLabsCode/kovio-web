'use client';

import { useEffect, useRef, useState } from 'react';

// A Kovio-styled date picker: drop-in replacement for <input type="date">
// (same YYYY-MM-DD value contract, min/max support) with a designed popover
// calendar instead of browser chrome. All date math is local-time safe.

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function fromKey(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
function pretty(s: string): string {
  const d = fromKey(s);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

export default function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  required,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const todayKey = toKey(new Date());
  const anchor = fromKey(value) ?? fromKey(min ?? '') ?? new Date();
  const [viewY, setViewY] = useState(anchor.getFullYear());
  const [viewM, setViewM] = useState(anchor.getMonth());

  // Re-anchor the visible month when opened.
  function openPicker() {
    const a = fromKey(value) ?? fromKey(min ?? '') ?? new Date();
    setViewY(a.getFullYear());
    setViewM(a.getMonth());
    setOpen(true);
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function shiftMonth(delta: number) {
    const d = new Date(viewY, viewM + delta, 1);
    setViewY(d.getFullYear());
    setViewM(d.getMonth());
  }

  function disabled(key: string): boolean {
    if (min && key < min) return true;
    if (max && key > max) return true;
    return false;
  }

  // Build a Monday-first grid for the visible month.
  const first = new Date(viewY, viewM, 1);
  const lead = (first.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(viewY, viewM, 1 - lead);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { key: toKey(d), day: d.getDate(), inMonth: d.getMonth() === viewM };
  });

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          className ??
          'flex w-full items-center justify-between rounded-[11px] border border-line bg-field px-[15px] py-[13px] text-left text-[15px] text-ink outline-none transition-colors focus:border-accent'
        }
      >
        <span className={value ? '' : 'text-faint'}>{value ? pretty(value) : placeholder}</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-faint">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3.5 9.5h17M8 3v3.6M16 3v3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {/* keeps native form "required" semantics without browser chrome */}
      {required && <input tabIndex={-1} aria-hidden="true" className="sr-only" required value={value} onChange={() => {}} />}

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="absolute z-30 mt-2 w-[292px] rounded-[14px] border border-line bg-panel p-3.5 shadow-[0_18px_50px_rgba(28,26,24,0.18)]"
        >
          {/* header */}
          <div className="flex items-center justify-between px-1">
            <div className="font-serif text-[16px] font-medium text-ink">
              {MONTHS[viewM]} <span className="text-muted">{viewY}</span>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink transition-colors hover:bg-tint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m14.5 5.5-7 6.5 7 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-[8px] text-ink transition-colors hover:bg-tint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m9.5 5.5 7 6.5-7 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>

          {/* weekday header */}
          <div className="mt-2.5 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="py-1 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                {w}
              </div>
            ))}
          </div>

          {/* days */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c) => {
              const isSel = c.key === value;
              const isToday = c.key === todayKey;
              const off = disabled(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={off}
                  onClick={() => {
                    onChange(c.key);
                    setOpen(false);
                  }}
                  aria-label={c.key}
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-[9px] text-[13.5px] transition-colors',
                    isSel
                      ? 'bg-accent font-semibold text-white'
                      : off
                        ? 'cursor-not-allowed text-faint/50 line-through decoration-transparent'
                        : c.inMonth
                          ? 'text-ink hover:bg-tint'
                          : 'text-faint hover:bg-tint',
                    !isSel && isToday ? 'ring-1 ring-inset ring-accent/60' : '',
                  ].join(' ')}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          {/* footer */}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="rounded-[8px] px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:bg-tint hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={disabled(todayKey)}
              onClick={() => {
                onChange(todayKey);
                setOpen(false);
              }}
              className="rounded-[8px] px-2.5 py-1.5 text-[13px] font-medium text-accent-dark transition-colors hover:bg-tint disabled:opacity-40"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
