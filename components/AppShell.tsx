import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { KovioMark } from './KovioMark';
import MobileMenuButton from './MobileMenuButton';
import AdminReturnPill from './AdminReturnPill';
import { createClient } from '@/lib/supabase/server';
// Search disabled for now — re-enable by restoring the import + <TopbarSearch /> below.
// import TopbarSearch from './TopbarSearch';

// Shared signed-in shell: collapsible rail + a sticky top bar (KOVIO / {page}
// breadcrumb, optional right-side action) + a 1320px content column.
// `page` and `action` are optional so existing pages keep working unchanged.
export default async function AppShell({
  children,
  page,
  action,
}: {
  children: ReactNode;
  page?: string;
  action?: ReactNode;
}) {
  // Admin view-as escape hatch: if the signed-in user is an admin currently
  // viewing Kovio as another org, pin a return pill to every shell page.
  // Silent no-op for everyone else.
  let viewingAs: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc('kovio_admin_viewing');
    const row = Array.isArray(data) ? data[0] : data;
    viewingAs = (row as { org_name?: string } | undefined)?.org_name ?? null;
  } catch {}

  return (
    <div className="flex min-h-screen bg-bg">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <main id="main-content" className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md backdrop-saturate-150 sm:px-6 sm:py-[18px] lg:px-9 print:hidden">
          <div className="flex min-w-0 items-center gap-2.5 font-mono text-[13px] text-muted">
            <MobileMenuButton />
            <KovioMark className="h-[18px] w-[18px] shrink-0 text-accent" />
            <span className="tracking-[0.06em]">KOVIO</span>
            {page && (
              <>
                <span className="text-line-strong">/</span>
                <span className="truncate text-ink">{page}</span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3.5">
            {/* <TopbarSearch /> */}
            {action}
          </div>
        </div>
        <div className="w-full max-w-[1320px] px-4 pb-10 pt-6 sm:px-6 lg:px-9 lg:pb-14 lg:pt-8">{children}</div>
      </main>
      {viewingAs && <AdminReturnPill orgName={viewingAs} />}
    </div>
  );
}
