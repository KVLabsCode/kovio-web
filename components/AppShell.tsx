import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { KovioMark } from './KovioMark';
import TopbarSearch from './TopbarSearch';

// Shared signed-in shell: collapsible rail + a sticky top bar (KOVIO / {page}
// breadcrumb, optional right-side action) + a 1320px content column.
// `page` and `action` are optional so existing pages keep working unchanged.
export default function AppShell({
  children,
  page,
  action,
}: {
  children: ReactNode;
  page?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-5 border-b border-line bg-bg/85 px-9 py-[18px] backdrop-blur-md backdrop-saturate-150 print:hidden">
          <div className="flex items-center gap-2.5 font-mono text-[13px] text-muted">
            <KovioMark className="h-[18px] w-[18px] text-accent" />
            <span className="tracking-[0.06em]">KOVIO</span>
            {page && (
              <>
                <span className="text-line-strong">/</span>
                <span className="text-ink">{page}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3.5">
            <TopbarSearch />
            {action}
          </div>
        </div>
        <div className="w-full max-w-[1320px] px-9 pb-14 pt-8">{children}</div>
      </main>
    </div>
  );
}
