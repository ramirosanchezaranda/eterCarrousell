/**
 * Anthropic Claude — dos modos:
 *   - `anthropic-bff`: pasa por `/api/generate` (server guarda la key).
 *   - `anthropic-direct`: llama al endpoint de Anthropic desde el browser
 *     con la key del usuario. Requiere header `anthropic-dangerous-direct-browser-access`
 *     (Anthropic lo soporta explícitamente desde 2024). La key queda en localStorage.
 *
 * Para Claude usamos el campo `system` aparte (no embebido en el user message),
 * que es la forma recomendada por Anthropic y mejora la obediencia del contrato.
 */
import { GeneratedSlideSchema, type GeneratedSlide } from '@carrousel/shared';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import { parseSlidesJson } from './openaiCompat';
import { fetchWithRetry } from './http';
import type { GenerateInput, ProviderConfig } from './types';

export async function anthropicBffGenerate(input: GenerateInput): Promise<GeneratedSlide[]> {
  const resp = await fetchWithRetry('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: input.topic, count: input.count, language: input.language }),
    signal: input.signal,
  });
  if (!resp.ok) throw new Error(`BFF ${resp.status}`);
  const { slides } = await resp.json() as { slides: unknown[] };
  const valid = slides
    .map((s) => GeneratedSlideSchema.safeParse(s))
    .filter((r): r is { success: true; data: GeneratedSlide } => r.success)
    .map((r) => r.data);
  if (valid.length === 0) throw new Error('BFF respondió sin slides válidas');
  return valid;
}

export async function anthropicDirectGenerate(
  input: GenerateInput,
  config: ProviderConfig,
): Promise<GeneratedSlide[]> {
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('API key de Anthropic requerida');
  const model = config.model ?? 'claude-sonnet-4-5';
  const system = buildSystemPrompt(input.language);
  const user = buildUserPrompt(input.topic, input.count, input.language);

  const resp = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: input.signal,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Anthropic ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json() as { content?: Array<{ type: string; text: string }> };
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseSlidesJson(text);
}
