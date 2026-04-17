/**
 * Google Gemini via REST API. Permite llamadas desde browser.
 * Free tier vía AI Studio (ai.google.dev).
 */
import type { GeneratedSlide } from '@carrousel/shared';
import { buildCarouselPrompt, extractJsonArray } from './prompt';
import { parseSlidesJson } from './openaiCompat';
import type { GenerateInput, ProviderConfig } from './types';

const DEFAULT_MODEL = 'gemini-1.5-flash';

export async function geminiGenerate(input: GenerateInput, config: ProviderConfig): Promise<GeneratedSlide[]> {
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('API key de Gemini requerida');
  const model = config.model ?? DEFAULT_MODEL;
  const prompt = buildCarouselPrompt(input.topic, input.count, input.language);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
    }),
    signal: input.signal,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Gemini ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return parseSlidesJson(extractJsonArray(text));
}
