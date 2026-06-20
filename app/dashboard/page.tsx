import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCount, formatMoney, formatPct } from '@/lib/format';
import AppShell from '@/components/AppShell';

const btnPrimary =
  'inline-flex items-center rounded-[11px] bg-accent px-6 py-[15px] text-[17px] text-white transition-colors hover:bg-accent-dark';

const startSteps = [
  {
    n: '1',
    title: 'Create your first campaign',
    desc: 'Pick a name, drop a creative, launch in two minutes.',
    link: 'Create campaign →',
  },
  {
    n: '2',
    title: 'Watch Hawkeye',
    desc: 'See live footage of robots running your ad, with verified attention.',
    link: 'See it live →',
  },
  {
    n: '3',
    title: 'Go paid when ready',
    desc: 'Set your own budget and schedule after the free trial.',
    link: 'Learn more →',
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function DashboardPage() {
  const [dash, camps, me] = await Promise.all([
    api.dashboard(),
    api.campaigns(),
    api.me(),
  ]);

  if (dash.error?.status === 404) redirect('/onboarding');
  if (dash.error || !dash.data) {
    return (
      <AppShell>
        <p className="text-sm text-danger">
          Couldn’t load your dashboard: {dash.error?.detail ?? 'unknown error'}
        </p>
      </AppShell>
    );
  }

  const campaigns = camps.data?.campaigns ?? [];
  const trialActive = campaigns.length === 0;
  const brand = me.data?.org.name ?? 'there';

  return (
    <AppShell>
      {/* 1. Hero panel */}
      <section className="mb-[26px] rounded-[18px] border border-line bg-panel-2 px-[46px] py-[44px]">
        <h1 className="font-serif text-[56px] font-medium leading-[1.02] tracking-[-0.015em] text-ink">
          Welcome, <em className="italic">{brand}.</em>
        </h1>
        {trialActive ? (
          <p className="mb-7 mt-4 max-w-[760px] text-[20px] leading-[1.5] text-muted">
            Your free trial covers{' '}
            <strong className="text-ink">one campaign</strong>, no card needed.
            Let’s get it running on robots around the city.
          </p>
        ) : (
          <p className="mb-7 mt-4 max-w-[760px] text-[20px] leading-[1.5] text-muted">
            You’re running on paid campaigns now. Spin up another whenever you’re
            ready.
          </p>
        )}
        <Link href="/campaigns/new" className={btnPrimary}>
          {trialActive ? '+ Create your first campaign' : '+ New campaign'}
        </Link>
      </section>

      {/* 2. Two-column grid */}
      <div className="mb-[26px] grid grid-cols-[1.7fr_1fr] gap-[26px]">
        {/* Left — Getting Started */}
        <section className="rounded-[18px] border border-line bg-panel px-9 py-[34px]">
          <div className="mb-[26px] font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
            GETTING STARTED
          </div>
          {startSteps.map((step, i) => (
            <div
              key={step.n}
              className={`flex gap-[18px] ${i === startSteps.length - 1 ? '' : 'mb-[26px]'}`}
            >
              <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-tint font-mono text-[14px] text-accent-dark">
                {step.n}
              </div>
              <div>
                <div className="text-[18px] font-semibold text-ink">
                  {step.title}
                </div>
                <div className="mt-0.5 text-[16px] leading-[1.45] text-muted">
                  {step.desc}
                </div>
                <Link
                  href="/campaigns/new"
                  className="mt-1 inline-block text-[16px] text-accent"
                >
                  {step.link}
                </Link>
              </div>
            </div>
          ))}
        </section>

        {/* Right — Plan card */}
        <section className="flex flex-col rounded-[18px] border border-line bg-panel-2 px-8 py-[30px]">
          <div className="flex items-start justify-between">
            <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
              YOUR PLAN
            </div>
            {trialActive ? (
              <span className="rounded-[20px] bg-tint px-[9px] py-1 font-mono text-[11px] text-accent-dark">
                FREE TRIAL
              </span>
            ) : (
              <span className="rounded-[20px] bg-tint px-[9px] py-1 font-mono text-[11px] text-muted">
                PAY AS YOU GO
              </span>
            )}
          </div>

          {trialActive ? (
            <>
              <div className="mt-4 font-serif text-[42px] leading-[1.04] text-ink">
                Your first / <br />
                campaign, free
              </div>
              <p className="mb-auto mt-3 text-[15px] text-muted">
                Launch the default citywide setup — no card needed.
              </p>
              <Link
                href="/campaigns/new"
                className="mt-6 inline-flex w-full items-center justify-center rounded-[11px] bg-accent px-6 py-[15px] text-[17px] text-white transition-colors hover:bg-accent-dark"
              >
                + Launch free campaign
              </Link>
            </>
          ) : (
            <>
              <div className="mt-4 font-serif text-[42px] leading-[1.04] text-ink">
                Pay per / <br />
                campaign
              </div>
              <p className="mb-auto mt-3 text-[15px] text-muted">
                Set a budget per campaign — only pay for what runs.
              </p>
              <Link
                href="/campaigns/new"
                className="mt-6 inline-flex w-full items-center justify-center rounded-[11px] bg-accent px-6 py-[15px] text-[17px] text-white transition-colors hover:bg-accent-dark"
              >
                + New paid campaign
              </Link>
            </>
          )}
        </section>
      </div>

      {/* 3. Campaigns area */}
      {campaigns.length === 0 ? (
        <section className="rounded-[18px] border border-dashed border-line-strong py-16 text-center">
          <div className="font-serif text-[34px] text-ink">No campaigns yet</div>
          <p className="mt-2 text-[18px] text-muted">
            Your first campaign takes about two minutes.
          </p>
          <Link href="/campaigns/new" className={`${btnPrimary} mt-6`}>
            + Create your first campaign
          </Link>
        </section>
      ) : (
        <section>
          <div className="mb-4 font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
            YOUR CAMPAIGNS
          </div>
          <div className="grid grid-cols-2 gap-5">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="block rounded-[16px] border border-line bg-panel px-[26px] py-6 transition-colors hover:bg-panel-2"
              >
                <div className="flex items-start justify-between">
                  <div className="font-serif text-[26px] text-ink">{c.name}</div>
                  <span className="rounded-[20px] bg-tint px-[9px] py-1 font-mono text-[11px] uppercase text-accent-dark">
                    {c.status}
                  </span>
                </div>
                <div className="mb-[18px] mt-1 text-[14px] text-muted">
                  {c.category ?? 'general'} · launched {formatDate(c.created_at)}
                </div>
                <div className="flex gap-7">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                      IMPRESSIONS
                    </div>
                    <div className="mt-1 text-[22px] font-semibold text-ink">
                      {formatCount(c.impressions_total ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                      SPENT
                    </div>
                    <div className="mt-1 text-[22px] font-semibold text-ink">
                      {formatMoney(c.budget_spent_cents)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                      ATTENTION
                    </div>
                    <div className="mt-1 text-[22px] font-semibold text-ink">
                      {c.attention_rate != null
                        ? formatPct(c.attention_rate)
                        : '—'}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
