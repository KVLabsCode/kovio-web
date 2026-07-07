'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Always-visible escape hatch while an admin is viewing Kovio as another org.
// Fixed to the bottom of every shell page; one click restores the admin's own
// account and returns to /admin.
export default function AdminReturnPill({ orgName }: { orgName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function returnToAdmin() {
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc('kovio_admin_return');
    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 print:hidden">
      <div className="flex items-center gap-3 rounded-full border border-[#4b4231] bg-[#211d18] py-2 pl-4 pr-2 text-[#f1ead9] shadow-[0_10px_34px_rgba(0,0,0,0.35)]">
        <span className="flex items-center gap-2 text-[13px]">
          <span className="k-pulse h-1.5 w-1.5 rounded-full bg-[#5cbe85]" />
          Admin — viewing as <span className="font-semibold">{orgName}</span>
        </span>
        <button
          onClick={returnToAdmin}
          disabled={busy}
          className="rounded-full bg-[#d38b50] px-3.5 py-1.5 text-[13px] font-medium text-[#211d18] transition-colors hover:bg-[#bc6f37] disabled:opacity-50"
        >
          {busy ? 'Returning…' : 'Return to admin'}
        </button>
      </div>
    </div>
  );
}
