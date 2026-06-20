'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { CATEGORIES, categoryLabel } from '@/lib/categories';

type Mode = 'trial' | 'paid';

interface Draft {
  name: string;
  category: string;
  budget: string;
  start: string; // yyyy-mm-dd
  duration: number;
  when: 'morning' | 'evening' | 'all';
  days: 'every' | 'weekdays' | 'weekends';
  creative: string;
  card: string;
  exp: string;
  cvc: string;
  cardName: string;
}


const WHEN_LABEL: Record<Draft['when'], string> = {
  morning: 'Mornings',
  evening: 'Evenings',
  all: 'All day',
};
const DAYS_LABEL: Record<Draft['days'], string> = {
  every: 'Every day',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
};
const BUDGET_CHIPS = [250, 500, 1000, 2500];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campaign';
}
function rand(n: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function fmt(iso: string, withYear = false): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export default function CampaignWizard({ trialAvailable }: { trialAvailable: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(trialAvailable ? 'trial' : 'paid');
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({
    name: '',
    category: 'food',
    budget: '500',
    start: todayISO(),
    duration: 7,
    when: 'all',
    days: 'every',
    creative: '',
    card: '',
    exp: '',
    cvc: '',
    cardName: '',
  });
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(todayISO() + 'T00:00:00');
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stepKeys = mode === 'trial' ? ['setup', 'creative', 'review'] : ['details', 'creative', 'payment', 'review'];
  const stepLabels = mode === 'trial' ? ['Setup', 'Creative', 'Review'] : ['Details', 'Creative', 'Payment', 'Review'];
  const stepKey = stepKeys[step - 1];
  const isFinal = step === stepKeys.length;

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function switchMode(m: Mode) {
    setMode(m);
    setStep(1);
    setCalOpen(false);
  }
  function next() {
    if (isFinal) launch();
    else setStep((s) => Math.min(stepKeys.length, s + 1));
  }
  function back() {
    if (step === 1) router.push('/dashboard');
    else setStep((s) => Math.max(1, s - 1));
  }

  function pickDay(day: number) {
    const iso = `${calMonth.y}-${String(calMonth.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    set('start', iso);
    setCalOpen(false);
  }
  function shiftMonth(delta: number) {
    setCalMonth(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  async function launch() {
    setLoading(true);
    setError('');
    const days = mode === 'trial' ? 7 : draft.duration;
    const startMs = new Date(draft.start + 'T00:00:00').getTime();
    const endIso = new Date(startMs + days * 86400000).toISOString();
    const body = {
      campaign_id: `${slugify(draft.name)}-${rand(4).toLowerCase()}`,
      name: draft.name.trim() || 'Untitled campaign',
      advertiser: draft.name.trim() || 'Brand',
      creative_url: draft.creative.trim() || 'creatives/demo.html',
      targeting: [{ field: 'person_count', op: '>=', value: 1 }],
      priority: 10,
      encounter_cap_seconds: 300,
      category: draft.category,
      budget_total_cents: mode === 'trial' ? 50000 : Number(draft.budget) * 100,
      cost_per_impression_cents: 10,
      cost_per_attended_cents: 5,
      start_at: new Date(draft.start + 'T00:00:00').toISOString(),
      end_at: endIso,
    };
    const { data, error } = await apiClient.createCampaign(body);
    if (error) {
      setLoading(false);
      setError(error.detail ?? 'Could not launch the campaign. Please try again.');
      return;
    }
    router.push(data?.id ? `/campaigns/${data.id}` : '/dashboard');
    router.refresh();
  }

  // ---- shared class fragments ----
  const inputCls =
    'w-full rounded-[11px] border border-line-strong bg-field px-[18px] py-4 text-[16px] text-ink outline-none transition-colors focus:border-accent';
  const labelCls = 'mb-2 block text-[17px] text-ink';
  const optBtn = (selected: boolean) =>
    `cursor-pointer rounded-[11px] border px-4 py-[15px] text-center text-[16px] transition-colors ${
      selected ? 'border-accent bg-accent-soft font-semibold text-accent-dark' : 'border-line-strong text-ink hover:bg-field'
    }`;

  const budgetDollars = `$${Number(draft.budget || 0).toLocaleString()}`;

  // ---- creative preview block ----
  const isImage = /^https?:\/\//i.test(draft.creative) && !/\.html?($|\?)/i.test(draft.creative);
  function CreativeBox({ h }: { h: number }) {
    if (isImage) {
      return (
        <div
          className="rounded-[12px] border-2 border-dashed border-line-strong bg-cover bg-center"
          style={{ height: h, backgroundImage: `url(${draft.creative})` }}
        />
      );
    }
    return (
      <div
        className="flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-line-strong"
        style={{
          height: h,
          backgroundImage:
            'repeating-linear-gradient(45deg,var(--field),var(--field) 12px,transparent 12px,transparent 24px)',
        }}
      >
        <div className="font-mono text-[13px] uppercase tracking-[0.12em] text-muted">Product shot</div>
        <div className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">Paste an image url below</div>
      </div>
    );
  }

  // ---- calendar ----
  function Calendar() {
    const first = new Date(calMonth.y, calMonth.m, 1).getDay();
    const daysIn = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    const today = todayISO();
    const cells: Array<number | null> = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= daysIn; d++) cells.push(d);
    return (
      <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[312px] rounded-[14px] border border-line-strong bg-panel-2 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => shiftMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-panel">
            ‹
          </button>
          <div className="font-serif text-[18px] text-ink">
            {MONTHS[calMonth.m]} {calMonth.y}
          </div>
          <button type="button" onClick={() => shiftMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-panel">
            ›
          </button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-center font-mono text-[11px] text-faint">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="h-[38px]" />;
            const iso = `${calMonth.y}-${String(calMonth.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = iso === today;
            const isSel = iso === draft.start;
            const isPast = iso < today;
            return (
              <div
                key={i}
                onClick={() => !isPast && pickDay(d)}
                className={`flex h-[38px] items-center justify-center rounded-[9px] border border-transparent text-[15px] ${
                  isSel
                    ? 'bg-accent text-white'
                    : isPast
                      ? 'cursor-default text-faint opacity-40'
                      : `cursor-pointer text-ink hover:bg-tint ${isToday ? 'border-accent-soft' : ''}`
                }`}
              >
                {d}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- progress rail ----
  function Rail() {
    return (
      <div className="mb-[26px] flex items-center justify-center">
        {stepLabels.map((label, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'active' : 'todo';
          return (
            <div key={label} className="flex items-center">
              {i > 0 && <div className="mx-3 h-px w-10 bg-line-strong" />}
              <div className="flex items-center">
                <div
                  className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full font-mono text-[14px] ${
                    state === 'todo' ? 'bg-accent-soft text-accent-dark' : 'bg-accent text-white'
                  }`}
                >
                  {n}
                </div>
                <div
                  className={`ml-2.5 text-[16px] ${
                    state === 'active' ? 'font-semibold text-ink' : state === 'done' ? 'text-ink' : 'text-muted'
                  }`}
                >
                  {label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---- footer ----
  function Footer() {
    let rightLabel = 'Continue →';
    if (isFinal) rightLabel = mode === 'trial' ? 'Launch campaign' : 'Pay & launch';
    else if (mode === 'paid' && stepKey === 'payment') rightLabel = 'Review →';
    return (
      <>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={back} className="rounded-[10px] px-[18px] py-3.5 text-ink transition-colors hover:bg-panel">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={loading}
            className="rounded-[11px] bg-accent px-[30px] py-4 text-[17px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
          >
            {loading && isFinal ? 'Launching…' : rightLabel}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </>
    );
  }

  const modeTabs = (
    <div className="mb-[30px] flex gap-1.5 rounded-[14px] border border-line-strong bg-field p-1.5">
      {(['trial', 'paid'] as Mode[]).map((m) => {
        const on = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 rounded-[10px] border px-4 py-[13px] text-left transition-colors ${
              on ? 'border-accent bg-accent-soft font-semibold text-accent-dark' : 'border-transparent text-ink'
            }`}
          >
            <div className="text-[16px] font-semibold">{m === 'trial' ? 'Free campaign' : 'Custom campaign'}</div>
            <div className="text-[13px] text-muted">
              {m === 'trial' ? 'One-tap default setup' : 'Your budget & schedule'}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-14">
      <div className="w-full max-w-[680px]">
        {/* header */}
        <div className="mb-7">
          <div className="text-center font-mono text-[13px] uppercase tracking-[0.16em] text-faint">Create campaign</div>
          <h1 className="mt-3.5 text-center font-serif text-[54px] font-medium leading-[1.02] tracking-[-0.02em] text-ink">
            New <em className="italic">campaign.</em>
          </h1>
        </div>

        <Rail />

        <div className="rounded-[18px] border border-line bg-panel px-9 py-[34px]">
          {step === 1 && trialAvailable && modeTabs}

          {/* TRIAL SETUP */}
          {stepKey === 'setup' && (
            <>
              <div className="mb-[26px] flex items-center gap-4 rounded-[14px] border border-tint-line bg-tint px-5 py-[18px]">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent font-serif text-[26px] text-white">◎</div>
                <div>
                  <div className="text-[19px] font-semibold text-accent-dark">Your first campaign is free</div>
                  <div className="text-[14px] text-accent-dark/80">
                    We&apos;ve set up a citywide default — just name it and launch. No card needed.
                  </div>
                </div>
              </div>
              <label className={labelCls}>Campaign name</label>
              <input
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="My first campaign"
                autoFocus
                className="mb-7 w-full rounded-[11px] border border-accent bg-field px-[18px] py-4 text-[17px] text-ink outline-none focus:border-accent"
              />
              <div className="mb-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-faint">We&apos;ve picked the rest for you</div>
              <div className="mb-[30px] overflow-hidden rounded-[13px] border border-line">
                {[
                  ['Placement', 'Citywide robot fleet'],
                  ['Schedule', `Starts ${fmt(draft.start)} · 7 days`],
                  ['Targeting', 'All day · Every day'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-t border-line bg-panel-2 px-[18px] py-[15px] first:border-t-0">
                    <span className="text-[15px] text-muted">{k}</span>
                    <span className="text-[16px] font-semibold text-ink">{v}</span>
                  </div>
                ))}
              </div>
              <Footer />
            </>
          )}

          {/* PAID DETAILS */}
          {stepKey === 'details' && (
            <>
              <label className={labelCls}>Campaign name</label>
              <input
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Summer Launch"
                autoFocus
                className="mb-6 w-full rounded-[11px] border border-accent bg-field px-[18px] py-4 text-[16px] text-ink outline-none focus:border-accent"
              />
              <label className={labelCls}>Category</label>
              <select value={draft.category} onChange={(e) => set('category', e.target.value)} className={`${inputCls} mb-[26px]`}>
                {CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between">
                <label className="text-[17px] text-ink">Budget</label>
                <div className="font-serif text-[30px] text-ink">{budgetDollars}</div>
              </div>
              <div className="mb-4 mt-3 grid grid-cols-4 gap-2.5">
                {BUDGET_CHIPS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => set('budget', String(b))}
                    className={`cursor-pointer rounded-[10px] border px-1.5 py-[13px] text-center text-[15px] transition-colors ${
                      draft.budget === String(b) ? 'border-accent bg-accent-soft font-semibold text-accent-dark' : 'border-line-strong text-ink hover:bg-field'
                    }`}
                  >
                    ${b.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={100}
                max={5000}
                step={50}
                value={draft.budget}
                onChange={(e) => set('budget', e.target.value)}
                className="mb-[7px] w-full accent-[var(--accent)]"
              />
              <div className="flex justify-between font-mono text-[12px] text-faint">
                <span>$100</span>
                <span>$5,000</span>
              </div>

              <label className={`${labelCls} mt-6`}>Start date</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCalOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-[11px] border border-line-strong px-[18px] py-4 text-left text-[16px] text-ink"
                >
                  <span>{fmt(draft.start, true)}</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-muted" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
                {calOpen && <Calendar />}
              </div>

              <label className={`${labelCls} mt-6`}>Duration</label>
              <div className="grid grid-cols-3 gap-3">
                {[7, 14, 30].map((d) => (
                  <button key={d} type="button" onClick={() => set('duration', d)} className={optBtn(draft.duration === d)}>
                    {d} days
                  </button>
                ))}
              </div>

              <label className={`${labelCls} mt-6`}>When should it run?</label>
              <div className="grid grid-cols-3 gap-3">
                {(['morning', 'evening', 'all'] as Draft['when'][]).map((w) => (
                  <button key={w} type="button" onClick={() => set('when', w)} className={optBtn(draft.when === w)}>
                    {WHEN_LABEL[w]}
                  </button>
                ))}
              </div>

              <label className={`${labelCls} mt-6`}>Days</label>
              <div className="mb-[30px] grid grid-cols-3 gap-3">
                {(['every', 'weekdays', 'weekends'] as Draft['days'][]).map((d) => (
                  <button key={d} type="button" onClick={() => set('days', d)} className={optBtn(draft.days === d)}>
                    {DAYS_LABEL[d]}
                  </button>
                ))}
              </div>
              <Footer />
            </>
          )}

          {/* CREATIVE */}
          {stepKey === 'creative' && (
            <>
              <div className="mb-[22px] font-mono text-[13px] uppercase tracking-[0.14em] text-faint">Creative</div>
              <div className="mb-[22px]">
                <CreativeBox h={340} />
              </div>
              <label className="mb-2 block text-[17px] text-muted">…or paste an image URL</label>
              <input value={draft.creative} onChange={(e) => set('creative', e.target.value)} placeholder="https://…" className={`${inputCls} mb-[30px]`} />
              <Footer />
            </>
          )}

          {/* PAYMENT */}
          {stepKey === 'payment' && (
            <>
              <div className="mb-[22px] font-mono text-[13px] uppercase tracking-[0.14em] text-faint">Payment</div>
              <div className="mb-[26px] flex items-center justify-between rounded-[13px] border border-line bg-panel-2 px-[22px] py-[18px]">
                <span className="text-[16px] text-muted">Campaign budget</span>
                <span className="font-serif text-[30px] text-ink">{budgetDollars}</span>
              </div>
              <label className={labelCls}>Name on card</label>
              <input value={draft.cardName} onChange={(e) => set('cardName', e.target.value)} placeholder="Jane Appleseed" className={`${inputCls} mb-4`} />
              <label className={labelCls}>Card number</label>
              <input value={draft.card} onChange={(e) => set('card', e.target.value)} placeholder="4242 4242 4242 4242" className={`${inputCls} mb-4 font-mono`} />
              <div className="grid grid-cols-2 gap-[18px]">
                <div>
                  <label className={labelCls}>Expiry</label>
                  <input value={draft.exp} onChange={(e) => set('exp', e.target.value)} placeholder="MM / YY" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>CVC</label>
                  <input value={draft.cvc} onChange={(e) => set('cvc', e.target.value)} placeholder="123" className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div className="mb-7 mt-7 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">Test mode · no real charge</div>
              <Footer />
            </>
          )}

          {/* REVIEW */}
          {stepKey === 'review' && (
            <>
              <div className="mb-[22px] font-mono text-[13px] uppercase tracking-[0.14em] text-faint">Review &amp; launch</div>
              <div className="mb-1.5">
                <CreativeBox h={300} />
              </div>
              <div className="my-[18px] mb-[22px]">
                {(mode === 'trial'
                  ? [
                      ['Campaign', draft.name.trim() || 'Untitled'],
                      ['Placement', 'Citywide robot fleet'],
                      ['Schedule', `${fmt(draft.start)} · 7 days`],
                      ['Targeting', 'All day · Every day'],
                    ]
                  : [
                      ['Campaign', draft.name.trim() || 'Untitled'],
                      ['Category', categoryLabel(draft.category)],
                      ['Budget', budgetDollars],
                      ['Schedule', `${fmt(draft.start)} · ${draft.duration} days`],
                      ['Targeting', `${WHEN_LABEL[draft.when]} · ${DAYS_LABEL[draft.days]}`],
                    ]
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-dashed border-line py-4">
                    <span className="text-[17px] text-muted">{k}</span>
                    <span className="text-[17px] font-semibold text-ink">{v}</span>
                  </div>
                ))}
              </div>
              {mode === 'trial' ? (
                <div className="rounded-[12px] border border-tint-line bg-tint px-5 py-4 text-[17px] text-accent-dark">
                  Free campaign · default citywide setup · no card needed
                </div>
              ) : (
                <div className="flex justify-between rounded-[12px] border border-line bg-panel-2 px-5 py-4">
                  <span className="text-[16px] text-muted">
                    {budgetDollars} · card {draft.card.replace(/\s/g, '').slice(-4) || '----'}
                  </span>
                  <span className="text-[16px] font-semibold text-good">Ready to charge</span>
                </div>
              )}
              <div className="mt-7">
                <Footer />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
