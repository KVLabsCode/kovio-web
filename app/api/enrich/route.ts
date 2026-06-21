import { generateText, Output } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createClient } from '@/lib/supabase/server';
import { normalizeUrl, extractText, BrandSchema } from '@/lib/enrich';
import { safeFetch } from '@/lib/ssrf';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const ENRICH_MODEL = 'anthropic/claude-sonnet-4.5';

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let url: string | null = null;
  try {
    const body = await request.json();
    url = normalizeUrl(String(body?.url ?? ''));
  } catch {
    url = null;
  }
  if (!url) {
    return Response.json({ error: 'Enter a valid website URL.' }, { status: 400 });
  }

  let text: string;
  try {
    const res = await safeFetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    text = extractText(await res.text());
  } catch {
    return Response.json({ error: 'Could not reach that website.' }, { status: 502 });
  }

  try {
    const { output } = await generateText({
      model: openrouter(ENRICH_MODEL),
      output: Output.object({ schema: BrandSchema }),
      prompt:
        'You are helping an advertiser set up a robot-fleet ad campaign. ' +
        'From the website text below, identify the company. Respond with the ' +
        'company name, the best-fit category, a short catchy campaign name, and ' +
        'a one-sentence summary of what they do.\n\nWEBSITE TEXT:\n' + text,
    });
    return Response.json(output, { status: 200 });
  } catch {
    return Response.json({ error: 'Could not analyze that website.' }, { status: 502 });
  }
}
