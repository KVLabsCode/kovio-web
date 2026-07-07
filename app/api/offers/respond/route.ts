// POST /api/offers/respond — the advertiser confirms or declines the operator's
// proposed new dates. On confirm, the RPC applies them and the campaign is
// accepted. Emails the operator either way (best-effort).

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

  let body: { offerId?: string; accept?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.offerId || typeof body.accept !== 'boolean') {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('kovio_respond_counter', {
    p_offer_id: body.offerId,
    p_accept: body.accept,
  });

  if (error) {
    const map: Record<string, string> = {
      not_authorized: 'This isn’t your campaign.',
      offer_not_found: 'That campaign no longer exists.',
      not_countered: 'There are no proposed dates to respond to.',
    };
    const key = Object.keys(map).find((k) => (error.message || '').includes(k)) ?? '';
    return Response.json({ error: map[key] ?? 'Could not save your response.' }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const oemEmail: string | undefined = row?.oem_email;
  const campaignName: string = row?.campaign_name ?? 'a campaign';
  const accepted = body.accept;

  if (oemEmail) {
    await sendEmail({
      to: oemEmail,
      subject: accepted
        ? `New dates confirmed for “${campaignName}”`
        : `Advertiser declined the new dates for “${campaignName}”`,
      html: emailShell({
        heading: accepted ? 'The new dates were confirmed.' : 'The advertiser declined.',
        bodyHtml: accepted
          ? `The advertiser confirmed your proposed dates for <strong>“${campaignName}”</strong>. It’s cleared to run on your fleet.`
          : `The advertiser declined the proposed dates for <strong>“${campaignName}”</strong>. The campaign won’t run.`,
        cta: { label: 'Open Campaigns →', url: `${origin(request)}/oem/campaigns` },
      }),
    });
  }

  return Response.json({ ok: true, decision: accepted ? 'accepted' : 'rejected' });
}
