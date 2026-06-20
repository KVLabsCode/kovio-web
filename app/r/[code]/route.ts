import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('increment_scan', { p_code: code });
  if (error || !data) {
    return NextResponse.redirect(`${origin}/`, 302);
  }
  return NextResponse.redirect(String(data), 302);
}
