'use client';

export default function ExportPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[10px] border border-line-strong bg-panel px-4 py-2.5 text-[14px] text-ink transition-colors hover:bg-panel-2"
    >
      Export PDF
    </button>
  );
}
