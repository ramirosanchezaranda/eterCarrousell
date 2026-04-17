/**
 * POST /api/generate — Vercel Edge Function que proxifica a la API de Claude.
 * La API key vive en `process.env.ANTHROPIC_API_KEY` y nunca llega al cliente.
 *
 * Body: { topic, count?, language? }
 * Resp: { slides: GeneratedSlide[] }
 */
import { GenerateRequestSchema, GeneratedSlideSchema } from '@carrousel/shared';
import { buildPrompt } from '../lib/prompt';
import { checkRateLimit } from '../lib/rateLimit';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return json(
      { error: 'Rate limit exceeded' },
      429,
      { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(rl.resetAt) },
    );
  }
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  const { topic, count, language } = parsed.data;

  const key = (globalThis as any).process?.env?.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'Server not configured' }, 500);

  const prompt = buildPrompt(topic, count, language);
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) return json({ error: `Anthropic ${resp.status}` }, 502);
  const data = await resp.json() as any;
  let text = (data.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .replace(/```json|```/g, '')
    .trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  let parsedSlides: unknown;
  try { parsedSlides = JSON.parse(text); } catch { return json({ error: 'Could not parse response' }, 502); }
  if (!Array.isArray(parsedSlides)) return json({ error: 'Response is not an array' }, 502);
  const slides = parsedSlides.map((s) => GeneratedSlideSchema.safeParse(s)).filter((r) => r.success).map((r) => (r as any).data);
  if (slides.length === 0) return json({ error: 'No valid slides' }, 502);
  return json(
    { slides },
    200,
    { 'X-RateLimit-Remaining': String(rl.remaining), 'X-RateLimit-Reset': String(rl.resetAt) },
  );
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}
