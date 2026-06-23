'use client';

import { createClient } from '@/lib/supabase/client';

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
