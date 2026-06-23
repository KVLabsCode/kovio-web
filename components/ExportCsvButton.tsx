'use client';

// Builds a CSV from headers + rows and triggers a client-side download.
export default function ExportCsvButton({
  headers,
  rows,
  filename = 'export.csv',
  label = 'Export CSV',
}: {
  headers: string[];
  rows: (string | number)[][];
  filename?: string;
  label?: string;
}) {
  function download() {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="rounded-[10px] border border-line-strong bg-panel px-4 py-2.5 text-[14px] text-ink transition-colors hover:bg-panel-2"
    >
      {label}
    </button>
  );
}
