/**
 * Ollama local. Usa su endpoint nativo /api/chat (no OpenAI-compat).
 * Default: http://localhost:11434, modelo llama3.2.
 * No requiere auth.
 *
 * Para forzar JSON: `format: "json"` (nativo de Ollama). Ollama lo respeta
 * y vuelve solo cuando el modelo cierra el JSON, lo cual es la mejor defensa
 * contra modelos chicos como llama3.2 que tienden a empezar con prosa.
 *
 * Timeout largo (90s) porque la primera llamada a un modelo en frío puede
 * tardar mientras se carga en GPU/CPU.
 */
import type { GeneratedSlide } from '@carrousel/shared';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import { parseSlidesJson } from './openaiCompat';
import { fetchWithRetry } from './http';
import type { GenerateInput, ProviderConfig } from './types';

const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

export async function ollamaGenerate(input: GenerateInput, config: ProviderConfig): Promise<GeneratedSlide[]> {
  const endpoint = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, '');
  const model = config.model ?? DEFAULT_MODEL;
  const system = buildSystemPrompt(input.language);
  const user = buildUserPrompt(input.topic, input.count, input.language);

  const resp = await fetchWithRetry(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: { temperature: 0.3 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: input.signal,
    timeoutMs: 90_000,
    retries: 1,
  });
  if (!resp.ok) {
    throw new Error(`Ollama ${resp.status} — ¿está corriendo en ${endpoint}?`);
  }
  const data = await resp.json() as { message?: { content?: string } };
  const text = data.message?.content ?? '';
  return parseSlidesJson(text);
}
