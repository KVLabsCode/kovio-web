// Same-origin playlist JSON for the player's in-page refresh. The player polls
// this every ~20s and swaps media without a page reload, so the screen stays
// fullscreen (no browser chrome) and the wake-lock holds.

import { fetchPlaylist } from '@/lib/display';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  const playlist = await fetchPlaylist(code);
  return new Response(JSON.stringify(playlist), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
