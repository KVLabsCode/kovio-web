import Link from 'next/link';
import { redirect } from 'next/navigation';
import { redirectMissingOrg } from '@/lib/org-redirect';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Campaign } from '@/lib/types';
import AppShell from '@/components/AppShell';
import ExportCsvButton from '@/components/ExportCsvButton';

const STATUS_PILL: Record<string, string> = {
  active: 'bg-panel-2 text-good',
  paused: 'bg-tint text-accent-dark',
  completed: 'bg-panel-2 text-muted',
  draft: 'bg-panel-2 text-muted',
  pending_review: 'bg-tint text-accent-dark',
  rejected: 'bg-panel-2 text-danger',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const newCampaignBtn = (
  <Link
    href="/campaigns/new"
    className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-[18px] py-2.5 text-[14px] text-white transition-colors hover:bg-accent-dark"
  >
    + New campaign
  </Link>
);

export default async function BillingPage() {
  const [me, dash, camps] = await Promise.all([api.me(), api.dashboard(), api.campaigns()]);

  if (me.error?.status === 404) await redirectMissingOrg('advertiser');
  if (me.error || !me.data) {
    return (
      <AppShell page="Billing">
        <p className="text-sm text-danger">Couldn’t load billing: {me.error?.detail ?? 'unknown error'}</p>
      </AppShell>
    );
  }

  const balance = me.data.org.balance_cents;
  const spent30d = dash.data?.spent_30d_cents ?? 0;
  const activeCount = dash.data?.active_campaigns ?? 0;
  const campaigns: Campaign[] = camps.data?.campaigns ?? [];

  // Charges = per-campaign spend to date (real). No invoice docs yet → "—".
  const charges = [...campaigns]
    .filter((c) => (c.budget_spent_cents ?? 0) > 0 || c.status === 'active')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const csvRows = charges.map((c) => [
    fmtDate(c.created_at),
    c.name,
    c.status,
    (c.budget_spent_cents / 100).toFixed(2),
  ]);

  return (
    <AppShell page="Billing" action={newCampaignBtn}>
      <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">Account</div>
      <h1 className="mt-2 font-serif text-[46px] font-medium leading-[1.04] tracking-[-0.02em] text-ink">
        Billing.
      </h1>

      {/* summary */}
      <div className="mt-[26px] grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="flex flex-col rounded-[18px] border border-tint-line bg-tint p-[26px]">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-dark">Billing model</div>
          <div className="mt-2.5 font-serif text-[34px] leading-[1.05] tracking-[-0.01em] text-ink">
            Pay per campaign.
          </div>
          <div className="mt-2.5 text-[14px] leading-[1.5] text-muted">
            Each campaign is priced upfront — the fleet’s rate × your dates — and paid once via
            Stripe when you submit. No balances to manage, no surprise charges.
          </div>
        </div>
        <div className="rounded-[18px] border border-line bg-panel p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Billed · 30d</div>
          <div className="mt-2.5 font-mono text-[34px] tracking-[-0.01em] text-ink">{formatMoney(spent30d)}</div>
          <div className="mt-2 text-[13px] text-muted">across {activeCount} active campaign{activeCount === 1 ? '' : 's'}</div>
        </div>
        <div className="rounded-[18px] border border-line bg-panel p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Credit</div>
          <div className="mt-2.5 font-mono text-[34px] tracking-[-0.01em] text-ink">{formatMoney(balance)}</div>
          <div className="mt-2 text-[13px] text-muted">payments received, applied to your campaigns</div>
        </div>
      </div>

      {/* payment method — honest to our in-flow Stripe model (no saved-card mgmt yet) */}
      <div className="mt-[18px] rounded-[16px] border border-line bg-panel px-6 py-[22px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Payment method</div>
        <div className="mt-3.5 flex items-center gap-4">
          <div className="flex h-[34px] w-[52px] items-center justify-center rounded-[7px] bg-[#332c24] font-mono text-[11px] tracking-[0.06em] text-[#f1ead9]">
            STRIPE
          </div>
          <div>
            <div className="text-[15px] font-semibold text-ink">Secured by Stripe</div>
            <div className="text-[13px] text-faint">
              You’re charged the set price when you submit a campaign. No saved card or top-ups to manage.
            </div>
          </div>
        </div>
      </div>

      {/* charges */}
      <div className="mt-8">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-faint">Charges &amp; invoices</div>
          <ExportCsvButton
            headers={['Date', 'Campaign', 'Status', 'Amount (USD)']}
            rows={csvRows}
            filename="kovio-charges.csv"
          />
        </div>
        <div className="overflow-hidden rounded-[16px] border border-line bg-panel">
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_0.9fr] gap-4 border-b border-line px-6 py-3.5 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            <span>Date</span>
            <span>Campaign</span>
            <span>Status</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Invoice</span>
          </div>
          {charges.length === 0 ? (
            <div className="px-6 py-12 text-center text-[14px] text-faint">
              No charges yet — your payments and invoices will appear here.
            </div>
          ) : (
            charges.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[1fr_2fr_1fr_1fr_0.9fr] items-center gap-4 border-b border-line px-6 py-[15px] last:border-0"
              >
                <span className="font-mono text-[14px] text-muted">{fmtDate(c.created_at)}</span>
                <Link href={`/campaigns/${c.id}`} className="truncate text-[15px] text-ink hover:text-accent-dark">
                  {c.name}
                </Link>
                <span>
                  <span className={`rounded-[20px] px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.06em] ${STATUS_PILL[c.status] ?? 'bg-panel-2 text-muted'}`}>
                    {c.status}
                  </span>
                </span>
                <span className="text-right font-mono text-[15px] text-ink">{formatMoney(c.budget_spent_cents)}</span>
                <span className="text-right font-mono text-[13px] text-faint">—</span>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 text-[12px] text-faint">
          Itemized PDF invoices arrive here once a campaign completes its billing period.
        </p>
      </div>
    </AppShell>
  );
}
