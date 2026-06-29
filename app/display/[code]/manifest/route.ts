// Per-display web app manifest. When the operator does "Add to Home screen" on
// the tablet, Chrome/Android launches /display/<code> in `display: fullscreen`
// mode — no tabs, no address bar — and it stays chromeless across the player's
// 60s refresh. Scope is locked to this one display.

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  const manifest = {
    name: 'Kovio Display',
    short_name: 'Kovio',
    start_url: `/display/${code}`,
    scope: `/display/${code}`,
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
}
