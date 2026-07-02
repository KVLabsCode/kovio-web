'use client';

import { createClient } from '@/lib/supabase/client';
import type { DisplayQrConfig } from '@/lib/display-qr';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function genCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function createLink(input: {
  target_url: string;
  image_url: string | null;
  show_qr?: boolean;
}): Promise<{ code: string } | { error: string }> {
  const code = genCode(8);
  const supabase = createClient();
  const { error } = await supabase.from('campaign_links').insert({
    code,
    target_url: input.target_url,
    image_url: input.image_url,
    show_qr: input.show_qr ?? true,
  });
  if (error) return { error: error.message };
  return { code };
}

export async function attachCampaign(code: string, campaignId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('campaign_links').update({ campaign_id: campaignId }).eq('code', code);
}

export async function updateLinkImage(
  code: string,
  imageUrl: string | null,
  showQr?: boolean,
): Promise<void> {
  const supabase = createClient();
  const patch: { image_url: string | null; show_qr?: boolean } = { image_url: imageUrl };
  if (showQr !== undefined) patch.show_qr = showQr;
  await supabase.from('campaign_links').update(patch).eq('code', code);
}

// --- OEM custom-campaign QR overlay ------------------------------------------
// The QR overlay for a custom display is stored in `display_qr` (placement +
// enabled) and points at a `campaign_links` row (the tracked /r/<code> target).

export async function loadDisplayQr(displayCode: string): Promise<DisplayQrConfig | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('display_qr')
    .select('link_code, enabled, x, y, size')
    .eq('display_code', displayCode)
    .maybeSingle();
  if (error || !data) return null;

  let targetUrl = '';
  if (data.link_code) {
    const { data: link } = await supabase
      .from('campaign_links')
      .select('target_url')
      .eq('code', data.link_code)
      .maybeSingle();
    targetUrl = link?.target_url ?? '';
  }

  return {
    enabled: !!data.enabled,
    targetUrl,
    x: data.x,
    y: data.y,
    size: data.size,
    linkCode: data.link_code ?? null,
  };
}

export async function saveDisplayQr(
  displayCode: string,
  cfg: DisplayQrConfig,
): Promise<{ linkCode: string | null; error?: string }> {
  const supabase = createClient();
  const target = cfg.targetUrl.trim();

  // A tracked link is needed whenever there's a target to redirect to. Reuse the
  // existing code if we have one, otherwise mint a fresh /r/<code>.
  let linkCode = cfg.linkCode;
  if (target) {
    if (linkCode) {
      const { error } = await supabase
        .from('campaign_links')
        .update({ target_url: target })
        .eq('code', linkCode);
      if (error) return { linkCode, error: error.message };
    } else {
      linkCode = genCode(8);
      const { error } = await supabase
        .from('campaign_links')
        .insert({ code: linkCode, target_url: target });
      if (error) return { linkCode: null, error: error.message };
    }
  }

  // Nothing to persist yet (no link and nothing enabled) — leave the row absent.
  if (!linkCode) return { linkCode: null };

  const { error } = await supabase.from('display_qr').upsert(
    {
      display_code: displayCode,
      link_code: linkCode,
      enabled: cfg.enabled && !!target,
      x: cfg.x,
      y: cfg.y,
      size: cfg.size,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'display_code' },
  );
  if (error) return { linkCode, error: error.message };
  return { linkCode };
}
