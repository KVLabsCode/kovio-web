// POST /api/admin/invite-operator — admin mints a claim link for an operator
// org (e.g. Robot.com) and emails it to the OEM contact, who signs in with that
// email at /claim/<token> to take over the account. Admin gating happens in the
// RPC (kovio_admin_create_claim raises not_admin).

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

  let body: { orgId?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.orgId || !body.email?.trim()) {
    return Response.json({ error: 'Pick the operator and enter their email.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('kovio_admin_create_claim', {
    p_org_id: body.orgId,
    p_email: body.email.trim(),
  });
  if (error) {
    const map: Record<string, string> = {
      not_admin: 'Admins only.',
      invalid_org: 'That organization doesn’t exist.',
      invalid_email: 'Enter a valid email address.',
    };
    const key = Object.keys(map).find((k) => (error.message || '').includes(k)) ?? '';
    return Response.json({ error: map[key] ?? 'Could not create the invite.' }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const token: string | undefined = row?.token;
  const orgName: string = row?.org_name ?? 'your fleet';
  if (!token) return Response.json({ error: 'Could not create the invite.' }, { status: 500 });

  const claimUrl = `${origin(request)}/claim/${token}`;
  const sent = await sendEmail({
    to: body.email.trim(),
    subject: `Claim your ${orgName} account on Kovio`,
    html: emailShell({
      heading: `Your ${orgName} account is ready.`,
      bodyHtml:
        `Kovio set up the <strong>${orgName}</strong> fleet-operator account for you. ` +
        `Claim it with this link — sign in with <strong>this email address</strong> and you’re in: ` +
        `campaign inbox, pricing and schedule settings, and earnings.<br/><br/>` +
        `The link expires in 14 days and only works for this email.`,
      cta: { label: `Claim ${orgName} →`, url: claimUrl },
    }),
  });

  return Response.json({ ok: true, emailed: sent.ok, claimUrl });
}
