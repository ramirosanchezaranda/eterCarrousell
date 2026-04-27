/**
 * Google Gemini via REST API. Permite llamadas desde browser.
 * Free tier vía AI Studio (ai.google.dev).
 *
 * Tres trucos para forzar JSON estructurado en Gemini-Flash:
 *   1. systemInstruction separado (Gemini lo respeta más que un user message largo).
 *   2. responseMimeType: "application/json".
 *   3. responseSchema con la forma exacta del array de slides.
 */
import type { GeneratedSlide } from '@carrousel/shared';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import { parseSlidesJson } from './openaiCompat';
import { fetchWithRetry } from './http';
import type { GenerateInput, ProviderConfig } from './types';

const DEFAULT_MODEL = 'gemini-1.5-flash';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    slides: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['cover', 'observation', 'contrast', 'quote', 'stat', 'cta'] },
          line1: { type: 'STRING' },
          line2: { type: 'STRING' },
          number: { type: 'STRING' },
          caption: { type: 'STRING' },
        },
        required: ['type', 'line1'],
      },
    },
  },
  required: ['slides'],
};

export async function geminiGenerate(input: GenerateInput, config: ProviderConfig): Promise<GeneratedSlide[]> {
  const apiKey = config.apiKey;
  if (!apiKey) throw new Error('API key de Gemini requerida');
  const model = config.model ?? DEFAULT_MODEL;
  const system = buildSystemPrompt(input.language);
  const user = buildUserPrompt(input.topic, input.count, input.language);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const resp = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: input.signal,
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Gemini ${resp.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await resp.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return parseSlidesJson(text);
}
