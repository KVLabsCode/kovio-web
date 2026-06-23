import { generateText, Output } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const MODEL = 'anthropic/claude-sonnet-4.5';

const QualitySchema = z.object({
  verdict: z.enum(['good', 'needs_work']),
  // One short sentence shown verbatim to the advertiser.
  note: z.string().max(120),
});

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let url: string | null = null;
  try {
    const body = await request.json();
    url = String(body?.url ?? '').trim() || null;
  } catch {
    url = null;
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return Response.json({ error: 'Provide an image URL.' }, { status: 400 });
  }

  try {
    const { output } = await generateText({
      model: openrouter(MODEL),
      output: Output.object({ schema: QualitySchema }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'You are reviewing an advertising creative that will play on screens ' +
                'mounted on robots in public spaces. Judge only its visual quality: ' +
                'resolution/sharpness, composition, lighting, and legibility of any text ' +
                'at a glance. Return verdict "good" if it is a solid, professional ad ' +
                'creative, otherwise "needs_work". For note, write ONE short sentence ' +
                '(max ~14 words) the advertiser will see: if good, a brief positive like ' +
                '"Looks good — sharp and clear"; if needs_work, lead with "Needs more ' +
                'quality:" and the single biggest reason (e.g. "blurry", "text too small ' +
                'to read", "low resolution").',
            },
            { type: 'image', image: new URL(url) },
          ],
        },
      ],
    });
    return Response.json(output, { status: 200 });
  } catch {
    return Response.json({ error: 'Could not analyze that creative.' }, { status: 502 });
  }
}
