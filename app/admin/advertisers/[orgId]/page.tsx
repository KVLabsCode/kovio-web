import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KovioMark } from '@/components/KovioMark';
import AdminShowcase from '@/components/AdminShowcase';
import InviteControl from '@/components/InviteControl';
import ShowcaseResults from '@/components/ShowcaseResults';
import { ViewAsButton } from '@/components/ViewAsControls';
import type { AdminAdvertiserOrg } from '@/components/AdminAdvertisers';
import type { ShowcaseCampaign } from '@/lib/showcase';

// Dedicated onboarding builder for one prospect advertiser: upload footage,
// generate the processed results, preview exactly what they'll see on the
// claim page, and send/copy the claim link.
export default async function AdvertiserBuilderPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: isAdmin } = await supabase.rpc('kovio_is_admin');
  if (!isAdmin) redirect('/admin');

  const [advsRes, showsRes] = await Promise.all([
    supabase.rpc('kovio_admin_advertisers'),
    supabase.rpc('kovio_admin_showcases', { p_org_id: orgId }),
  ]);
  const org = ((advsRes.data as AdminAdvertiserOrg[]) ?? []).find((a) => a.org_id === orgId);
  if (!org) notFound();
  const showcases = (showsRes.data as ShowcaseCampaign[]) ?? [];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-10 border-b border-border-soft bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-[11px]">
            <KovioMark className="h-5 w-5 text-accent" />
            <span className="font-mono text-[15px] tracking-[0.18em]">KOVIO</span>
            <span className="font-mono text-[11px] tracking-[0.14em] text-faint">/ ADMIN</span>
          </div>
          <Link href="/admin" className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
            ← Control room
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">ADVERTISER ONBOARDING</p>
            <h1 className="mt-1 font-serif text-h1 text-ink">{org.name}.</h1>
            <p className="mt-1 text-sm text-ink-2">
              {org.member_emails.length > 0
                ? `Claimed by ${org.member_emails.join(', ')}`
                : org.pending_invite
                  ? `Claim link pending (${org.pending_invite})`
                  : 'Not claimed yet — build their results below, then send the claim link.'}
            </p>
          </div>
          <ViewAsButton orgId={org.org_id} />
        </div>

        {/* 1 · build */}
        <section className="mt-8">
          <h2 className="mb-1 font-serif text-h2 text-ink">1 · Showcase campaigns</h2>
          <p className="mb-3 text-sm text-ink-2">
            Add footage (YouTube link or uploaded video) with location and duration — Hawkeye-style
            interaction metrics are generated for each campaign. Add as many as you like.
          </p>
          <AdminShowcase orgId={org.org_id} defaultOpen />
        </section>

        {/* 2 · preview */}
        <section className="mt-10">
          <h2 className="mb-1 font-serif text-h2 text-ink">2 · What {org.name} will see</h2>
          <p className="mb-4 text-sm text-ink-2">
            A live preview of their claim page — the results report with “Claim your account” at the bottom.
          </p>
          {showcases.length > 0 ? (
            <div className="rounded-[20px] border border-border-soft bg-bg p-4 sm:p-8">
              <ShowcaseResults orgName={org.name} campaigns={showcases} />
              <div className="mx-auto mt-8 max-w-[420px] rounded-[16px] border border-tint-line bg-tint p-5 text-center opacity-90">
                <div className="font-serif text-[22px] text-ink">Claim your {org.name} account.</div>
                <div className="mt-2 rounded-[11px] bg-accent py-3 text-[14px] font-medium text-white">
                  Claim your {org.name} account →
                </div>
                <p className="mt-2 text-[11px] text-muted">(the working claim form renders here on the real page)</p>
              </div>
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-border-soft p-10 text-center text-sm text-ink-2">
              Add a showcase campaign above to see the preview.
            </div>
          )}
        </section>

        {/* 3 · send */}
        <section className="mt-10 pb-16">
          <h2 className="mb-1 font-serif text-h2 text-ink">3 · Send the claim link</h2>
          <p className="mb-2 text-sm text-ink-2">
            Copy the link to share anywhere, or email it — the email pitches “your results are ready”.
            Locking it to their email is recommended.
          </p>
          <div className="rounded-lg border border-border-soft bg-card p-4">
            <InviteControl orgId={org.org_id} pendingInvite={org.pending_invite} who="advertiser" />
          </div>
        </section>
      </main>
    </div>
  );
}
