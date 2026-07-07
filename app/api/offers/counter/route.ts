// POST /api/offers/counter — the operator sends a pending campaign back with
// proposed new dates ("do it on another day"). Status becomes 'countered'; the
// advertiser confirms or declines on /campaigns/placements. Emails the
// advertiser (best-effort).

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

  let body: { offerId?: string; startAt?: string; endAt?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.offerId || (!body.startAt && !body.endAt)) {
    return Response.json({ error: 'Pick the new dates first.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('kovio_counter_offer', {
    p_offer_id: body.offerId,
    p_counter: {
      start_at: body.startAt || null,
      end_at: body.endAt || null,
    },
    p_note: body.note?.trim() || null,
  });

  if (error) {
    const map: Record<string, string> = {
      not_authorized: 'This campaign isn’t addressed to your fleet.',
      offer_not_found: 'That campaign no longer exists.',
      already_decided: 'This campaign has already been decided.',
    };
    const key = Object.keys(map).find((k) => (error.message || '').includes(k)) ?? '';
    return Response.json({ error: map[key] ?? 'Could not send the new dates.' }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const advEmail: string | undefined = row?.advertiser_email;
  const campaignName: string = row?.campaign_name ?? 'your campaign';

  if (advEmail) {
    await sendEmail({
      to: advEmail,
      subject: `New dates proposed for “${campaignName}”`,
      html: emailShell({
        heading: 'The operator proposed new dates.',
        bodyHtml:
          `The fleet operator can’t run <strong>“${campaignName}”</strong> on your requested dates and proposed new ones` +
          (body.note?.trim() ? ` — “${body.note.trim()}”` : '') +
          `. Review and confirm, or decline.`,
        cta: { label: 'Review the new dates →', url: `${origin(request)}/campaigns/placements` },
      }),
    });
  }

  return Response.json({ ok: true });
}
