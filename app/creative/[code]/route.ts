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
  const { data } = await supabase
    .from('campaign_links')
    .select('image_url')
    .eq('code', code)
    .maybeSingle();

  if (!data) {
    return new Response('<!doctype html><title>Not found</title><body></body>', {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  const svg = await qrSvg(`${origin}/r/${code}`);
  const image = data.image_url ?? '';
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
  ${image ? `<img class="art" src="${escapeAttr(image)}" alt="">` : ''}
  <div class="qr">${svg}<div class="scan">Scan me</div></div>
</div></body></html>`;

  return new Response(html, { status: 200, headers: HTML_HEADERS });
}
