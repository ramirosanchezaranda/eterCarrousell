/**
 * POST /api/generate — Vercel Edge Function que proxifica a la API de Claude.
 * La API key vive en `process.env.ANTHROPIC_API_KEY` y nunca llega al cliente.
 *
 * Body: { topic, count?, language? }
 * Resp: { slides: GeneratedSlide[] }
 */
import { GenerateRequestSchema, GeneratedSlideSchema } from '@carrousel/shared';
import { buildSystem, buildUser } from '../lib/prompt';
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

  const system = buildSystem(language);
  const user = buildUser(topic, count, language);

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
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!resp.ok) return json({ error: `Anthropic ${resp.status}` }, 502);
  const data = await resp.json() as any;
  const text = (data.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  const arrayJson = extractSlidesJson(text);
  let parsedSlides: unknown;
  try { parsedSlides = JSON.parse(arrayJson); } catch { return json({ error: 'Could not parse response' }, 502); }
  if (!Array.isArray(parsedSlides)) return json({ error: 'Response is not an array' }, 502);
  const slides = parsedSlides.map((s) => GeneratedSlideSchema.safeParse(s)).filter((r) => r.success).map((r) => (r as any).data);
  if (slides.length === 0) return json({ error: 'No valid slides' }, 502);
  return json(
    { slides },
    200,
    { 'X-RateLimit-Remaining': String(rl.remaining), 'X-RateLimit-Reset': String(rl.resetAt) },
  );
}

/**
 * Extrae el array de slides desde la respuesta del LLM. Acepta:
 *   - {"slides":[...]} (forma canónica del nuevo prompt)
 *   - [...] (legacy)
 *   - texto envuelto en fences ```json
 *   - basura antes/después.
 */
function extractSlidesJson(raw: string): string {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  // Si arranca con `{` (objeto), intentamos parsear y descender por keys conocidas.
  if (cleaned.startsWith('{')) {
    try {
      const obj = JSON.parse(cleaned);
      const candidate = obj?.slides ?? obj?.data ?? obj?.result ?? obj?.carousel;
      if (Array.isArray(candidate)) return JSON.stringify(candidate);
    } catch { /* cae al fallback abajo */ }
  }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return cleaned;
  return cleaned.slice(start, end + 1);
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}
