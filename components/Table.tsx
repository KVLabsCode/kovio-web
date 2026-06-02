import Link from 'next/link';
import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  caption?: string;
  meta?: string;
  rowHref?: (row: T) => string;
  rightAction?: ReactNode;
};

// Div-grid table (kept server-renderable + whole-row links by avoiding an
// onClick handler — rows are <Link> when rowHref is given).
export function Table<T>({ columns, rows, caption, meta, rowHref, rightAction }: Props<T>) {
  const gridCols = `2fr ${columns
    .slice(1)
    .map(() => '1fr')
    .join(' ')}`;

  return (
    <div className="rounded-lg border border-border-soft bg-card p-6">
      {(caption || rightAction) && (
        <div className="flex items-center justify-between">
          {caption && <h3 className="text-base text-ink">{caption}</h3>}
          {rightAction}
        </div>
      )}
      {meta && <div className="mt-1 font-mono text-label uppercase text-ink-3">{meta}</div>}

      <div className="mt-4">
        {/* header */}
        <div
          className="grid gap-4 border-b border-border-soft pb-2"
          style={{ gridTemplateColumns: gridCols }}
        >
          {columns.map((c) => (
            <div
              key={c.key}
              className={`font-mono text-label uppercase text-ink-3 ${
                c.align === 'right' ? 'text-right' : 'text-left'
              }`}
            >
              {c.label}
            </div>
          ))}
        </div>

        {/* rows */}
        {rows.map((row, i) => {
          const cells = (
            <div
              className="grid items-center gap-4"
              style={{ gridTemplateColumns: gridCols }}
            >
              {columns.map((c) => (
                <div
                  key={c.key}
                  className={`text-sm text-ink ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.render(row)}
                </div>
              ))}
            </div>
          );
          const rowClass =
            'block h-14 content-center border-b border-dashed border-border-soft transition-colors duration-200';
          return rowHref ? (
            <Link key={i} href={rowHref(row)} className={`${rowClass} hover:bg-card-hover`}>
              {cells}
            </Link>
          ) : (
            <div key={i} className={rowClass}>
              {cells}
            </div>
          );
        })}
      </div>
    </div>
  );
}
