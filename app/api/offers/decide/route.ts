// POST /api/offers/decide — an OEM accepts or rejects an incoming custom
// campaign. The RPC verifies the caller's org owns the offer. On success we
// notify the advertiser (best-effort) that their campaign was accepted/rejected.

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

  let body: { offerId?: string; decision?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const decision = body.decision;
  if (!body.offerId || (decision !== 'accepted' && decision !== 'rejected')) {
    return Response.json({ error: 'Invalid decision.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('kovio_decide_offer', {
    p_offer_id: body.offerId,
    p_decision: decision,
    p_reason: body.reason?.trim() || null,
  });

  if (error) {
    const map: Record<string, string> = {
      not_authorized: 'This campaign isn’t addressed to your fleet.',
      offer_not_found: 'That campaign no longer exists.',
      already_decided: 'This campaign has already been decided.',
    };
    const key = Object.keys(map).find((k) => (error.message || '').includes(k)) ?? '';
    return Response.json({ error: map[key] ?? 'Could not save your decision.' }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const advEmail: string | undefined = row?.advertiser_email;
  const campaignName: string = row?.campaign_name ?? 'your campaign';

  if (advEmail) {
    const accepted = decision === 'accepted';
    const reasonLine = !accepted && body.reason?.trim()
      ? `<br/><br/><span style="color:#6e6555">Reason given:</span> ${body.reason.trim()}`
      : '';
    await sendEmail({
      to: advEmail,
      subject: accepted
        ? `Accepted: “${campaignName}” is cleared to run`
        : `Update on your custom campaign “${campaignName}”`,
      html: emailShell({
        heading: accepted ? 'Your campaign was accepted.' : 'Your campaign wasn’t accepted.',
        bodyHtml: accepted
          ? `The fleet operator accepted <strong>“${campaignName}”</strong>. It’s cleared to run on their robots.`
          : `The fleet operator didn’t accept <strong>“${campaignName}”</strong> this time.${reasonLine}`,
        cta: { label: 'View your campaigns →', url: `${origin(request)}/campaigns` },
      }),
    });
  }

  return Response.json({ ok: true, decision });
}
