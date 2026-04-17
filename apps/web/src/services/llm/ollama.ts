/**
 * Ollama local. Usa su endpoint nativo /api/chat (no OpenAI-compat).
 * Default: http://localhost:11434, modelo llama3.2.
 * No requiere auth.
 */
import type { GeneratedSlide } from '@carrousel/shared';
import { buildCarouselPrompt, extractJsonArray } from './prompt';
import { parseSlidesJson } from './openaiCompat';
import type { GenerateInput, ProviderConfig } from './types';

const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

export async function ollamaGenerate(input: GenerateInput, config: ProviderConfig): Promise<GeneratedSlide[]> {
  const endpoint = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, '');
  const model = config.model ?? DEFAULT_MODEL;
  const prompt = buildCarouselPrompt(input.topic, input.count, input.language);
  const resp = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.7 },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: input.signal,
  });
  if (!resp.ok) {
    throw new Error(`Ollama ${resp.status} — ¿está corriendo en ${endpoint}?`);
  }
  const data = await resp.json() as { message?: { content?: string } };
  const text = data.message?.content ?? '';
  return parseSlidesJson(extractJsonArray(text));
}
