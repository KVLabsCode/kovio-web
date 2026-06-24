'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { apiClient } from '@/lib/api-client';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, categoryLabel } from '@/lib/categories';
import { buildCampaignBody, brandStepReady } from '@/lib/campaign-draft';
import { createLink, attachCampaign, updateLinkImage } from '@/lib/links';
import { FLEET_GO_LIVE } from '@/lib/fleet-clips';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const isVideoUrl = (u: string) => /\.(mp4|webm)(\?|#|$)/i.test(u);

type Mode = 'trial' | 'paid';

interface Draft {
  name: string;
  website: string;
  company: string;
  summary: string;
  code: string;
  category: string;
  budget: string;
  start: string; // yyyy-mm-dd
  duration: number;
  when: 'morning' | 'evening' | 'all';
  days: 'every' | 'weekdays' | 'weekends';
  creative: string;
  showQr: boolean;
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
// Default a new campaign's start to the fleet go-live date, so the default/trial
// setup is scheduled for when robots actually begin running ads. Never defaults
// to a past date once the go-live day has passed.
function defaultStartISO(): string {
  const today = todayISO();
  return FLEET_GO_LIVE > today ? FLEET_GO_LIVE : today;
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
    website: '',
    company: '',
    summary: '',
    code: '',
    category: 'food',
    budget: '500',
    start: defaultStartISO(),
    duration: 7,
    when: 'all',
    days: 'every',
    creative: '',
    showQr: true,
    card: '',
    exp: '',
    cvc: '',
    cardName: '',
  });
  const [enriching, setEnriching] = useState(false);
  const [enrichErr, setEnrichErr] = useState('');
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(todayISO() + 'T00:00:00');
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [quality, setQuality] = useState<{ verdict: 'good' | 'needs_work'; note: string } | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qrPreview, setQrPreview] = useState('');
  const [resuming, setResuming] = useState(false);
  const [resumeMsg, setResumeMsg] = useState('');
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  // Render the QR for the current link locally so toggling/preview is instant
  // (the served creative at /creative/[code] regenerates it server-side).
  useEffect(() => {
    if (!draft.code) {
      setQrPreview('');
      return;
    }
    QRCode.toDataURL(`${window.location.origin}/r/${draft.code}`, { margin: 1, width: 240 })
      .then(setQrPreview)
      .catch(() => setQrPreview(''));
  }, [draft.code]);

  // Returning from Stripe Checkout (in-flow campaign payment): restore the draft
  // saved before the redirect, then finalize.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resume = params.get('resume');
    if (!resume) return;
    let saved: { draft?: Draft; mode?: Mode } = {};
    try {
      saved = JSON.parse(localStorage.getItem('kovio_wizard_resume') || '{}');
    } catch {
      saved = {};
    }
    if (saved.draft) setDraft(saved.draft);
    if (saved.mode) setMode(saved.mode);
    window.history.replaceState({}, '', '/campaigns/new');

    if (resume === 'cancel') {
      localStorage.removeItem('kovio_wizard_resume');
      const keys =
        (saved.mode ?? 'paid') === 'trial'
          ? ['brand', 'setup', 'creative', 'review']
          : ['brand', 'details', 'creative', 'review', 'payment'];
      setStep(keys.length); // back to the payment step
      setError('Payment canceled. No charge was made, you can try again.');
      return;
    }

    // resume === success but the saved draft is gone (e.g. paid in a different
    // browser). The funds are safely on the balance — guide them to retry.
    if (!saved.draft) {
      localStorage.removeItem('kovio_wizard_resume');
      setError('Payment received. Your balance is funded, create your campaign again to finish.');
      return;
    }
    setResuming(true);
  }, []);

  // Finalize a paid campaign after payment: retry create until the webhook has
  // credited the balance (deposit-to-balance keeps funds safe across the redirect).
  useEffect(() => {
    if (!resuming || resumeMsg) return; // not attempting (idle or stalled awaiting retry)
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 14 && !cancelled; i++) {
        const r = await doLaunch();
        if (r === 'ok') {
          localStorage.removeItem('kovio_wizard_resume');
          return; // doLaunch redirects to the campaign on success
        }
        if (r === 'fail') {
          if (!cancelled)
            setResumeMsg(
              'We couldn’t finish your campaign, but your payment was received and your balance is funded. Retry to finish.',
            );
          return;
        }
        await new Promise((res) => setTimeout(res, 1800)); // 'retry': await the deposit webhook
      }
      if (!cancelled)
        setResumeMsg(
          'Payment received and your balance is funded. Finishing is taking longer than usual. Retry now.',
        );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resuming, resumeMsg]);

  async function checkQuality(url: string) {
    if (!url || !/^https?:\/\//i.test(url) || isVideoUrl(url)) {
      setQuality(null);
      return;
    }
    setQuality(null);
    setQualityLoading(true);
    try {
      const res = await fetch('/api/creative-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await res.json();
      if (res.ok && body?.verdict) setQuality(body);
    } catch {
      /* non-blocking: a failed quality check never stops the campaign */
    } finally {
      setQualityLoading(false);
    }
  }

  async function handleFile(file: File) {
    setUploadErr('');
    setQuality(null);
    const isVid = file.type === 'video/mp4';
    const isImg = IMAGE_TYPES.includes(file.type);
    if (!isImg && !isVid) {
      setUploadErr('Use a PNG, JPG, WEBP, GIF, or MP4 file.');
      return;
    }
    if (isImg && file.size > IMAGE_MAX_BYTES) {
      setUploadErr('Image is over the 8 MB limit.');
      return;
    }
    if (isVid && file.size > VIDEO_MAX_BYTES) {
      setUploadErr('Video is over the 50 MB limit.');
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${draft.code || 'draft'}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from('creatives')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setUploadErr(upErr.message || 'Upload failed. Please try again.');
        return;
      }
      const { data } = supabase.storage.from('creatives').getPublicUrl(path);
      set('creative', data.publicUrl);
      if (isImg) checkQuality(data.publicUrl);
    } catch {
      setUploadErr('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const stepKeys = mode === 'trial'
    ? ['brand', 'setup', 'creative', 'review']
    : ['brand', 'details', 'creative', 'review', 'payment'];
  const stepKey = stepKeys[step - 1];
  const isFinal = step === stepKeys.length;

  const STEP_META: Record<string, { label: string; subtitle: string; title: string }> = {
    brand: { label: 'Basics', subtitle: 'Your site & brand', title: 'Campaign basics.' },
    setup: { label: 'Setup', subtitle: 'Name & default', title: 'Quick setup.' },
    details: { label: 'Details', subtitle: 'Name, budget & schedule', title: 'Campaign details.' },
    creative: { label: 'Creative', subtitle: 'What robots show', title: 'Build your creative.' },
    review: { label: 'Review', subtitle: 'Check & confirm', title: 'Review campaign.' },
    payment: { label: 'Budget & launch', subtitle: 'Pay & go live', title: 'Budget & launch.' },
  };

  // On the paid Payment step, look up the current balance so we charge only the
  // shortfall — and skip Stripe entirely when the balance already covers it.
  useEffect(() => {
    if (stepKey !== 'payment' || mode !== 'paid') return;
    let active = true;
    setBalanceCents(null);
    apiClient.me().then(({ data }) => {
      if (active) setBalanceCents(data?.org?.balance_cents ?? 0);
    });
    return () => {
      active = false;
    };
  }, [stepKey, mode]);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
    // Editing any field clears a stale step error so it can't linger or follow
    // the user to a later step.
    if (error) setError('');
    if (enrichErr) setEnrichErr('');
  }
  function switchMode(m: Mode) {
    setMode(m);
    setStep(1);
    setCalOpen(false);
  }

  async function runEnrich() {
    setEnrichErr('');
    setEnriching(true);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: draft.website }),
      });
      const body = await res.json();
      if (!res.ok) {
        setEnrichErr(body?.error ?? 'Could not analyze that website.');
      } else {
        setDraft((d) => ({
          ...d,
          company: body.company ?? d.company,
          category: body.category ?? d.category,
          name: d.name || (body.campaignName ?? ''),
          summary: body.summary ?? '',
        }));
      }
    } catch {
      setEnrichErr('Could not analyze that website.');
    } finally {
      setEnriching(false);
    }
  }

  // Single source of truth for what each step requires. Returns an error
  // message to show, or null when the step is complete.
  function validateStep(key: string): string | null {
    switch (key) {
      case 'brand':
        return brandStepReady(draft) ? null : 'Enter your website to continue.';
      case 'setup':
      case 'details':
        if (!draft.name.trim()) return 'Give your campaign a name.';
        if (mode === 'paid' && !(Number(draft.budget) > 0))
          return 'Enter a budget greater than $0.';
        return null;
      case 'creative':
        return draft.creative.trim()
          ? null
          : 'Add a creative: upload an image/MP4 or paste an image URL.';
      default:
        return null;
    }
  }

  async function next() {
    const invalid = validateStep(stepKey);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(''); // step is valid — never carry an error forward

    if (isFinal) {
      if (stepKey === 'payment') {
        if (balanceCents === null) return; // balance still loading; button is disabled
        if (dueCents && dueCents > 0) return startPayment(dueCents);
        return launch(); // existing balance already covers the budget — no charge
      }
      return launch();
    }

    const nextKey = stepKeys[step]; // step is 1-based; stepKeys[step] is the next key
    if (nextKey === 'creative' && !draft.code) {
      const made = await createLink({
        target_url: draft.website,
        image_url: draft.creative || null,
        show_qr: draft.showQr,
      });
      if (!('code' in made)) {
        setError('Could not prepare your creative. Please try again.');
        return;
      }
      set('code', made.code);
    }
    setStep((s) => Math.min(stepKeys.length, s + 1));
  }

  function back() {
    setError('');
    setEnrichErr('');
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

  async function doLaunch(): Promise<'ok' | 'retry' | 'fail'> {
    const origin = window.location.origin;
    if (draft.code) await updateLinkImage(draft.code, draft.creative || null, draft.showQr);
    const body = buildCampaignBody({
      draft: {
        name: draft.name, company: draft.company, category: draft.category,
        budget: draft.budget, start: draft.start, duration: draft.duration, code: draft.code,
      },
      mode,
      origin,
    });
    const { data, error } = await apiClient.createCampaign(body);
    if (error) {
      // Paid campaign: the deposit webhook may not have credited yet — caller retries.
      if (error.code === 'insufficient_balance') return 'retry';
      // A retry after a lost response: the campaign was already created last
      // attempt (deterministic id hit the unique constraint). Treat as done.
      if (error.code === 'campaign_id_taken') {
        router.push('/dashboard');
        router.refresh();
        return 'ok';
      }
      setError(error.detail ?? 'Could not launch the campaign. Please try again.');
      return 'fail';
    }
    if (data?.id && draft.code) await attachCampaign(draft.code, data.id);
    router.push(data?.id ? `/campaigns/${data.id}` : '/dashboard');
    router.refresh();
    return 'ok';
  }

  // Trial (free) launch from the Review step. Paid launches go through Stripe
  // first (startPayment → resume → doLaunch).
  async function launch() {
    setLoading(true);
    setError('');
    const r = await doLaunch();
    if (r !== 'ok') setLoading(false);
  }

  // Paid: charge the campaign budget via Stripe Checkout in-flow, then return to
  // the wizard to finalize. Deposit-to-balance means the funds are safe even if
  // the round-trip is interrupted.
  async function startPayment(amountCents: number) {
    setLoading(true);
    setError('');
    if (draft.code) await updateLinkImage(draft.code, draft.creative || null, draft.showQr);
    try {
      localStorage.setItem('kovio_wizard_resume', JSON.stringify({ draft, mode }));
    } catch {
      /* private mode / quota — resume just won't auto-restore */
    }
    const { data, error } = await apiClient.checkout(amountCents, {
      success_path: '/campaigns/new?resume=1',
      cancel_path: '/campaigns/new?resume=cancel',
    });
    if (error) {
      setLoading(false);
      if (error.code === 'stripe_unconfigured') setError('Payments aren’t enabled yet. Please try again shortly.');
      else if (error.code === 'invalid_amount') setError('Choose a budget greater than $0.');
      else setError(error.detail ?? 'Could not start checkout. Please try again.');
      return;
    }
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
    setLoading(false);
    setError('Could not start checkout. Please try again.');
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
  const budgetCents = Math.max(0, Math.round(Number(draft.budget || 0) * 100));
  // What the buyer must actually pay now: budget minus any existing balance.
  // null while the balance is still loading on the payment step.
  const dueCents = balanceCents === null ? null : Math.max(0, budgetCents - balanceCents);
  const dueDollars = `$${Math.round((dueCents ?? budgetCents) / 100).toLocaleString()}`;

  // ---- creative preview block ----
  const isImage = /^https?:\/\//i.test(draft.creative) && !/\.html?($|\?)/i.test(draft.creative);
  function CreativeBox({ h }: { h: number }) {
    if (draft.creative && isVideoUrl(draft.creative)) {
      return (
        <video
          src={draft.creative}
          className="w-full rounded-[12px] border-2 border-dashed border-line-strong object-cover"
          style={{ height: h }}
          autoPlay
          muted
          loop
          playsInline
        />
      );
    }
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

  // ---- vertical stepper (design: numbered dots + title/subtitle + connectors) ----
  function Stepper() {
    return (
      <div className="hidden flex-col gap-1 lg:sticky lg:top-[88px] lg:flex">
        {stepKeys.map((k, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          const m = STEP_META[k];
          return (
            <div key={k}>
              <div className="flex items-start gap-3 p-2" style={{ opacity: active ? 1 : done ? 0.9 : 0.5 }}>
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full font-mono text-[13px] ${
                    n <= step ? 'bg-accent text-white' : 'bg-panel-2 text-faint'
                  }`}
                >
                  {n}
                </span>
                <div>
                  <div className="text-[15px] font-semibold text-ink">{m.label}</div>
                  <div className="text-[13px] text-faint">{m.subtitle}</div>
                </div>
              </div>
              {i < stepKeys.length - 1 && <div className="ml-[21px] h-3.5 w-px bg-line" />}
            </div>
          );
        })}
      </div>
    );
  }

  // ---- footer ----
  function Footer() {
    const paying = isFinal && stepKey === 'payment';
    const willCharge = paying && !!dueCents && dueCents > 0;
    let rightLabel = 'Continue →';
    if (isFinal && mode === 'trial') rightLabel = 'Launch campaign';
    else if (paying) {
      if (balanceCents === null) rightLabel = 'Checking balance…';
      else rightLabel = willCharge ? `Pay ${dueDollars} →` : 'Launch campaign';
    }
    const loadingLabel = willCharge ? 'Redirecting…' : 'Launching…';
    return (
      <>
        <div className="mt-[30px] flex items-center justify-between border-t border-line pt-[22px]">
          <button type="button" onClick={back} className="rounded-[11px] border border-line-strong bg-panel px-5 py-3 text-[15px] text-ink transition-colors hover:bg-panel-2">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={loading || (paying && balanceCents === null)}
            className="inline-flex items-center gap-2 rounded-[11px] bg-accent px-6 py-3 text-[15px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
          >
            {loading && isFinal ? loadingLabel : rightLabel}
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

  if (resuming) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-14">
        <div className="w-full max-w-[460px] rounded-[18px] border border-line bg-panel px-9 py-[44px] text-center">
          <div className="font-mono text-[13px] uppercase tracking-[0.16em] text-faint">Payment received</div>
          {resumeMsg ? (
            <>
              <h1 className="mt-4 font-serif text-[32px] font-medium tracking-[-0.01em] text-ink">
                Almost there.
              </h1>
              <p className="mt-3 text-[15px] text-muted">{resumeMsg}</p>
              <button
                type="button"
                onClick={() => setResumeMsg('')}
                className="mt-6 w-full rounded-[11px] bg-accent px-6 py-3.5 text-[16px] font-semibold text-white transition-colors hover:bg-accent-dark"
              >
                Finish launching →
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="mt-3 text-[14px] text-muted transition-colors hover:text-ink"
              >
                Go to dashboard
              </button>
            </>
          ) : (
            <>
              <h1 className="mt-4 font-serif text-[34px] font-medium tracking-[-0.01em] text-ink">
                Launching your campaign…
              </h1>
              <p className="mt-3 text-[15px] text-muted">
                Confirming your payment with Stripe and starting your campaign. This takes a few
                seconds.
              </p>
              <div className="mx-auto mt-6 h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1060px]">
      {/* header */}
      <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-faint">
        New campaign · Step {step} of {stepKeys.length}
      </div>
      <h1 className="mt-2 font-serif text-[44px] font-medium leading-[1.04] tracking-[-0.02em] text-ink">
        {STEP_META[stepKey].title}
      </h1>
      {step === 1 && trialAvailable && <div className="mt-6 max-w-[560px]">{modeTabs}</div>}

      <div className="mt-[34px] grid grid-cols-1 gap-10 lg:grid-cols-[230px_1fr] lg:items-start">
        <Stepper />
        <div className="rounded-[18px] border border-line bg-panel p-8">

          {/* BRAND */}
          {stepKey === 'brand' && (
            <>
              <div className="mb-[22px] font-mono text-[13px] uppercase tracking-[0.14em] text-faint">Your brand</div>
              <label className={labelCls}>Company website</label>
              <div className="flex gap-2.5">
                <input
                  value={draft.website}
                  onChange={(e) => set('website', e.target.value)}
                  onBlur={() => brandStepReady(draft) && !draft.company && runEnrich()}
                  placeholder="acme.com"
                  autoFocus
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={runEnrich}
                  disabled={enriching || !brandStepReady(draft)}
                  className="rounded-[11px] bg-accent px-5 py-4 text-[16px] text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
                >
                  {enriching ? 'Reading…' : 'Fetch details'}
                </button>
              </div>
              <p className="mt-2 text-[14px] text-muted">We&apos;ll scan your site to pre-fill the rest and add a scannable QR to your ad.</p>

              {draft.company && (
                <div className="mt-6 rounded-[14px] border border-tint-line bg-tint px-5 py-[18px]">
                  <div className="text-[13px] font-mono uppercase tracking-[0.12em] text-accent-dark/70">We found you</div>
                  <label className={`${labelCls} mt-3`}>Company name</label>
                  <input value={draft.company} onChange={(e) => set('company', e.target.value)} className={`${inputCls} mb-3`} />
                  {draft.summary && <p className="text-[15px] text-accent-dark/80">{draft.summary}</p>}
                </div>
              )}

              {enrichErr && <p className="mt-3 text-sm text-danger">{enrichErr}</p>}
              <div className="mt-[30px]"><Footer /></div>
            </>
          )}

          {/* TRIAL SETUP */}
          {stepKey === 'setup' && (
            <>
              <div className="mb-[26px] flex items-center gap-4 rounded-[14px] border border-tint-line bg-tint px-5 py-[18px]">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent font-serif text-[26px] text-white">◎</div>
                <div>
                  <div className="text-[19px] font-semibold text-accent-dark">Your first campaign is free</div>
                  <div className="text-[14px] text-accent-dark/80">
                    We&apos;ve set up a citywide default. Just name it and launch, no card needed.
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

              {/* Live preview — image or MP4, with optional QR overlay */}
              <div className="relative mb-[18px] flex h-[340px] w-full items-center justify-center overflow-hidden rounded-[12px] border-2 border-dashed border-line-strong bg-black">
                {draft.creative ? (
                  isVideoUrl(draft.creative) ? (
                    <video src={draft.creative} className="h-full w-full object-cover" autoPlay muted loop playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.creative} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
                    Upload or paste a creative
                  </div>
                )}
                {draft.showQr && qrPreview && (
                  <div className="absolute bottom-[4%] right-[4%] w-[22%] max-w-[150px] rounded-[12px] bg-white p-[2%] shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrPreview} alt="QR code" className="block w-full" />
                    <div className="mt-1 text-center text-[12px] font-semibold text-black">Scan me</div>
                  </div>
                )}
              </div>

              {/* Upload + QR toggle */}
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <label className={`cursor-pointer rounded-[11px] border px-4 py-3 text-[15px] transition-colors ${uploading ? 'border-line-strong text-muted' : 'border-line-strong text-ink hover:border-accent'}`}>
                  {uploading ? 'Uploading…' : 'Upload image or MP4'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => set('showQr', !draft.showQr)}
                  className={`inline-flex items-center gap-2 rounded-[11px] border px-4 py-3 text-[15px] transition-colors ${draft.showQr ? 'border-accent bg-accent-soft font-semibold text-accent-dark' : 'border-line-strong text-ink hover:border-accent'}`}
                >
                  {draft.showQr ? '✓ QR code on' : 'Add QR code'}
                  <span
                    title="QR scan can reach your website directly"
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-current text-[11px] opacity-70"
                  >
                    i
                  </span>
                </button>
              </div>
              <div className="mb-3 text-[12px] text-faint">Images up to 8&nbsp;MB · MP4 up to 50&nbsp;MB</div>
              {uploadErr && <p className="mb-3 text-[14px] text-danger">{uploadErr}</p>}

              <label className="mb-2 block text-[15px] text-muted">…or paste an image URL</label>
              <input
                value={draft.creative}
                onChange={(e) => set('creative', e.target.value)}
                onBlur={(e) => checkQuality(e.target.value)}
                placeholder="https://…"
                className={`${inputCls} mb-3`}
              />

              {/* AI quality pointer (images only) */}
              {qualityLoading && (
                <p className="mb-[30px] text-[14px] text-muted">Checking creative quality…</p>
              )}
              {quality && !qualityLoading && (
                <div
                  className={`mb-[30px] rounded-[11px] border px-4 py-3 text-[14px] ${
                    quality.verdict === 'good'
                      ? 'border-good/40 bg-good/10 text-good'
                      : 'border-danger/40 bg-danger/10 text-danger'
                  }`}
                >
                  {quality.verdict === 'good' ? '✓ ' : '⚠ '}
                  {quality.note}
                </div>
              )}
              {!quality && !qualityLoading && <div className="mb-[30px]" />}

              <Footer />
            </>
          )}

          {/* PAYMENT */}
          {stepKey === 'payment' && (
            <>
              <div className="mb-[22px] font-mono text-[13px] uppercase tracking-[0.14em] text-faint">Payment</div>
              <div className="mb-[18px] flex items-center justify-between rounded-[13px] border border-line bg-panel-2 px-[22px] py-[18px]">
                <span className="text-[16px] text-muted">Amount due now</span>
                <span className="font-serif text-[30px] text-ink">
                  {balanceCents === null ? '—' : dueDollars}
                </span>
              </div>
              {balanceCents !== null && balanceCents > 0 && (
                <div className="mb-[18px] flex items-center justify-between text-[14px] text-muted">
                  <span>Campaign budget {budgetDollars}</span>
                  <span>
                    {`$${Math.round(Math.min(balanceCents, budgetCents) / 100).toLocaleString()}`} applied from balance
                  </span>
                </div>
              )}
              <p className="mb-[18px] text-[15px] text-muted">
                {balanceCents === null
                  ? 'Checking your balance…'
                  : dueCents && dueCents > 0
                    ? 'Pay securely via Stripe. Your campaign launches automatically right after. You’re billed only as your ad actually plays; unspent budget stays on your balance.'
                    : 'Your balance covers this campaign. No payment needed; tap Launch to start. You’re billed only as your ad actually plays.'}
              </p>
              <div className="mb-7 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
                Secure checkout · Stripe
              </div>
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
                  <span className="text-[16px] text-muted">{budgetDollars} budget · paid via Stripe next</span>
                  <span className="text-[16px] font-semibold text-good">Continue to pay</span>
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
