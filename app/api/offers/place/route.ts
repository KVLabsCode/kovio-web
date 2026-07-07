// POST /api/offers/place — an advertiser places a custom campaign with an OEM.
// Runs server-side so it can (a) resolve identity + insert via the SECURITY
// DEFINER RPC as the authenticated user, and (b) email the target OEM using the
// server-only Resend key. Email is best-effort; the offer is the source of truth.

import { createClient } from '@/lib/supabase/server';
import { sendEmail, emailShell } from '@/lib/email';
import { usd, type PlaceOfferBody } from '@/lib/offers';

function origin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  let body: PlaceOfferBody;
  try {
    body = (await request.json()) as PlaceOfferBody;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.targetOemId) return Response.json({ error: 'Choose a fleet operator to place with.' }, { status: 400 });
  if (!body.name?.trim()) return Response.json({ error: 'Give the campaign a name.' }, { status: 400 });
  if (!body.creativeUrl) return Response.json({ error: 'Add a creative.' }, { status: 400 });

  const { data, error } = await supabase.rpc('kovio_place_offer', {
    p_target_oem: body.targetOemId,
    p_target_fleet: body.targetFleetId || null,
    p_name: body.name.trim(),
    p_advertiser_name: body.advertiserName?.trim() || '',
    p_creative_url: body.creativeUrl,
    p_creative_type: body.creativeType || 'image',
    p_category: body.category || null,
    p_targeting: body.targeting ?? [],
    p_budget_cents: Math.max(0, Math.round(body.budgetCents ?? 0)),
    p_cpi: body.cpiCents ?? null,
    p_message: body.message?.trim() || null,
  });

  if (error) {
    const map: Record<string, string> = {
      invalid_target_oem: 'That fleet operator is no longer available.',
      invalid_target_fleet: 'That fleet doesn’t belong to the selected operator.',
    };
    const key = (error.message || '').match(/invalid_target_\w+/)?.[0] ?? '';
    return Response.json({ error: map[key] ?? 'Could not place the campaign.' }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const offerId: string | undefined = row?.offer_id;
  const oemEmail: string | undefined = row?.oem_email;
  const oemName: string = row?.oem_name ?? 'your fleet';

  // Notify the OEM (best-effort).
  let emailed = false;
  if (oemEmail) {
    const advertiser = body.advertiserName?.trim() || 'An advertiser';
    const budgetLine = body.budgetCents ? ` with a ${usd(body.budgetCents)} budget` : '';
    const res = await sendEmail({
      to: oemEmail,
      subject: `New custom campaign for ${oemName}: “${body.name.trim()}”`,
      html: emailShell({
        heading: 'You have a new custom campaign.',
        bodyHtml:
          `<strong>${advertiser}</strong> wants to run <strong>“${body.name.trim()}”</strong> on your robots${budgetLine}. ` +
          `Review the creative and targeting, then accept or reject it from your Campaigns tab.`,
        cta: { label: 'Review the campaign →', url: `${origin(request)}/oem/campaigns` },
      }),
    });
    emailed = res.ok;
  }

  return Response.json({ ok: true, offerId, emailed });
}
