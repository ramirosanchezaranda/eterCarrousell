/**
 * Cliente genérico para endpoints OpenAI-compatible (Groq, OpenAI, Mistral,
 * LM Studio, Together AI, y cualquier proxy que implemente /v1/chat/completions).
 * Se configura con endpoint + model + apiKey.
 */
import { GeneratedSlideSchema, type GeneratedSlide } from '@carrousel/shared';
import { buildCarouselPrompt, extractJsonArray } from './prompt';
import type { GenerateInput, ProviderConfig } from './types';

interface OpenAICompatOptions {
  endpoint: string;
  model: string;
  apiKey?: string;
  /** Algunos providers (LM Studio local) no requieren auth */
  requireAuth?: boolean;
}

export async function openaiCompatGenerate(
  input: GenerateInput,
  config: ProviderConfig,
  defaults: OpenAICompatOptions,
): Promise<GeneratedSlide[]> {
  const endpoint = (config.endpoint ?? defaults.endpoint).replace(/\/$/, '');
  const model = config.model ?? defaults.model;
  const apiKey = config.apiKey ?? defaults.apiKey;
  if (defaults.requireAuth !== false && !apiKey) {
    throw new Error('API key requerida para este proveedor');
  }
  const prompt = buildCarouselPrompt(input.topic, input.count, input.language);
  const resp = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
    signal: input.signal,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${resp.statusText}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseSlidesJson(text);
}

export function parseSlidesJson(raw: string): GeneratedSlide[] {
  const text = extractJsonArray(raw);
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('Respuesta no es JSON válido'); }
  if (!Array.isArray(parsed)) throw new Error('Respuesta no es un array');
  const valid = parsed
    .map((s) => GeneratedSlideSchema.safeParse(s))
    .filter((r): r is { success: true; data: GeneratedSlide } => r.success)
    .map((r) => r.data);
  if (valid.length === 0) throw new Error('Ninguna slide del array pasó validación');
  return valid;
}
