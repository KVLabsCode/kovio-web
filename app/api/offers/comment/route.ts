// POST /api/offers/comment — add a comment to an offer thread (advertiser ↔
// operator ↔ Kovio). The RPC checks the caller can access the offer and returns
// both sides' emails so we can notify the counterpart (best-effort).

import { createClient } from '@/lib/supabase/server';
import { sendEmail, emailShell } from '@/lib/email';

function origin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  let body: { offerId?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const text = body.body?.trim();
  if (!body.offerId || !text) return Response.json({ error: 'Write a comment first.' }, { status: 400 });
  if (text.length > 2000) return Response.json({ error: 'Keep comments under 2000 characters.' }, { status: 400 });

  const { data, error } = await supabase.rpc('kovio_add_offer_comment', {
    p_offer_id: body.offerId,
    p_body: text,
  });
  if (error) {
    const notAllowed = (error.message || '').includes('not_authorized');
    return Response.json(
      { error: notAllowed ? 'You don’t have access to this campaign.' : 'Could not post the comment.' },
      { status: notAllowed ? 403 : 400 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  const role: string = row?.author_role ?? '';
  const campaignName: string = row?.campaign_name ?? 'a campaign';
  const advEmail: string | null = row?.advertiser_email ?? null;
  const oemEmail: string | null = row?.oem_email ?? null;

  // Notify the other side (Kovio comments notify both). Best-effort.
  const base = origin(request);
  const recipients: Array<{ to: string; cta: string }> = [];
  if (role === 'advertiser' && oemEmail) recipients.push({ to: oemEmail, cta: `${base}/oem/campaigns` });
  if (role === 'operator' && advEmail) recipients.push({ to: advEmail, cta: `${base}/campaigns/placements` });
  if (role === 'kovio') {
    if (advEmail) recipients.push({ to: advEmail, cta: `${base}/campaigns/placements` });
    if (oemEmail) recipients.push({ to: oemEmail, cta: `${base}/oem/campaigns` });
  }
  const authorLabel = role === 'advertiser' ? 'The advertiser' : role === 'operator' ? 'The fleet operator' : 'Kovio';
  await Promise.all(
    recipients.map((r) =>
      sendEmail({
        to: r.to,
        subject: `New comment on “${campaignName}”`,
        html: emailShell({
          heading: `${authorLabel} left a comment.`,
          bodyHtml: `On <strong>“${campaignName}”</strong>:<br/><br/><em>“${text.slice(0, 500)}”</em>`,
          cta: { label: 'View & reply →', url: r.cta },
        }),
      }),
    ),
  );

  return Response.json({ ok: true });
}
