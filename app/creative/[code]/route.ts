import { createClient } from '@/lib/supabase/server';
import { qrSvg } from '@/lib/qr';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_creative', { p_code: code });
  const row = Array.isArray(data) ? data[0] : null;

  if (!row) {
    return new Response('<!doctype html><title>Not found</title><body></body>', {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  const rawMedia = row.image_url ?? '';
  const media = /^https?:\/\//i.test(rawMedia) ? rawMedia : '';
  const isVideo = /\.(mp4|webm)(\?|#|$)/i.test(media);
  // show_qr defaults to true when the column/row doesn't carry it.
  const showQr = row.show_qr !== false;

  const art = media
    ? isVideo
      ? `<video class="art" src="${escapeAttr(media)}" autoplay muted loop playsinline></video>`
      : `<img class="art" src="${escapeAttr(media)}" alt="">`
    : '';
  const qr = showQr
    ? `<div class="qr">${await qrSvg(`${origin}/r/${code}`)}<div class="scan">Scan me</div></div>`
    : '';

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%;background:#000}
  .stage{position:relative;width:100vw;height:100vh;overflow:hidden}
  .art{width:100%;height:100%;object-fit:cover}
  .qr{position:absolute;right:4%;bottom:4%;width:22%;max-width:280px;
      background:#fff;padding:2.2%;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
  .qr svg{display:block;width:100%;height:auto}
  .scan{margin-top:6px;text-align:center;font:600 14px system-ui,sans-serif;color:#111}
</style></head>
<body><div class="stage">
  ${art}
  ${qr}
</div></body></html>`;

  return new Response(html, { status: 200, headers: HTML_HEADERS });
}
