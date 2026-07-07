// Server-only transactional email via Resend (REST — no SDK dependency).
// Only import from server code (route handlers / server components): it reads
// RESEND_API_KEY. Sending is best-effort — callers should not fail their
// operation if email fails, since the in-app inbox is the source of truth.

const ENDPOINT = 'https://api.resend.com/emails';

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Kovio <onboarding@resend.dev>';
  if (!key) return { ok: false, error: 'email_not_configured' };
  if (!opts.to) return { ok: false, error: 'no_recipient' };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `resend_${res.status}: ${detail.slice(0, 300)}` };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id };
  } catch {
    return { ok: false, error: 'email_send_failed' };
  }
}

// Minimal branded email shell — inline styles only (email clients ignore <style>).
export function emailShell(opts: { heading: string; bodyHtml: string; cta?: { label: string; url: string } }): string {
  const cta = opts.cta
    ? `<tr><td style="padding:28px 0 4px"><a href="${opts.cta.url}" style="display:inline-block;background:#c57a3f;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:11px">${opts.cta.label}</a></td></tr>`
    : '';
  return `<div style="background:#f2ecdc;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#f5efe3;border:1px solid #e0d6bf;border-radius:16px;padding:34px 36px">
      <tr><td style="font:600 15px/1 monospace;letter-spacing:.18em;color:#a8551f;padding-bottom:22px">KOVIO</td></tr>
      <tr><td style="font-size:24px;font-weight:600;color:#1c1a18;letter-spacing:-.01em;padding-bottom:14px">${opts.heading}</td></tr>
      <tr><td style="font-size:15px;line-height:1.6;color:#4a453c">${opts.bodyHtml}</td></tr>
      ${cta}
      <tr><td style="padding-top:28px;border-top:1px solid #e0d6bf;color:#9a8f77;font-size:12px;line-height:1.5;margin-top:20px">
        You’re receiving this because your fleet is on the Kovio network.
      </td></tr>
    </table>
  </td></tr></table>
</div>`;
}
