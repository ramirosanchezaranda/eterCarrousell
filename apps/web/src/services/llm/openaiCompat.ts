/**
 * Cliente genérico para endpoints OpenAI-compatible (Groq, OpenAI, Mistral,
 * LM Studio, Together AI, y cualquier proxy que implemente /v1/chat/completions).
 *
 * Pipeline anti-desvío para LLMs débiles:
 *   1. system + user separados (mejora obediencia en modelos chicos).
 *   2. response_format: json_object cuando el provider lo soporta.
 *   3. temperature 0.3 (baja para JSON estructurado).
 *   4. timeout + reintentos exponenciales en 429/5xx/red.
 *   5. parser tolerante: acepta {"slides":[...]}, [...], texto basura alrededor.
 *   6. validación permisiva en este nivel (al menos N slides con line1 y type
 *      válido) — el contrato estricto y la reparación viven en `repair.ts`.
 */
import { GeneratedSlideSchema, type GeneratedSlide } from '@carrousel/shared';
import { buildSystemPrompt, buildUserPrompt, extractJsonArray } from './prompt';
import { fetchWithRetry } from './http';
import type { GenerateInput, ProviderConfig } from './types';

interface OpenAICompatOptions {
  endpoint: string;
  model: string;
  apiKey?: string;
  /** Algunos providers (LM Studio local) no requieren auth */
  requireAuth?: boolean;
  /** Algunos providers no soportan response_format json_object */
  supportsJsonMode?: boolean;
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
  const system = buildSystemPrompt(input.language);
  const user = buildUserPrompt(input.topic, input.count, input.language);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  };
  if (defaults.supportsJsonMode !== false) {
    // OpenAI/Groq/Mistral/LM Studio aceptan este flag. Si el modelo no lo soporta,
    // el endpoint suele ignorar el campo en lugar de tirar 400.
    body.response_format = { type: 'json_object' };
  }

  const resp = await fetchWithRetry(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: input.signal,
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${resp.statusText}: ${errBody.slice(0, 200)}`);
  }
  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseSlidesJson(text);
}

/**
 * Parser tolerante: acepta `{"slides":[...]}`, `{"data":[...]}`, array desnudo,
 * y texto envuelto en fences. Normaliza strings (trim) y filtra slides que no
 * cumplen el schema PERMISIVO (type válido + line1 no vacío). El contrato
 * ESTRICTO se aplica después en el pipeline de validación.
 */
export function parseSlidesJson(raw: string): GeneratedSlide[] {
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('Respuesta vacía del modelo');
  }

  // Caso 1: probamos parsear como objeto entero, descender por keys conocidas.
  let parsed: unknown = tryParseEnvelope(raw);

  // Caso 2: si no fue un objeto válido, extraemos array y parseamos.
  if (parsed === undefined) {
    const arrText = extractJsonArray(raw);
    try {
      parsed = JSON.parse(arrText);
    } catch {
      throw new Error('Respuesta no es JSON válido');
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Respuesta no es un array de slides');
  }

  // Pre-limpieza: trim de strings, descartar valores no-string en campos texto.
  const normalized = parsed.map((s) => {
    if (!s || typeof s !== 'object') return s;
    const o = s as Record<string, unknown>;
    const trim = (v: unknown): string | undefined => typeof v === 'string' ? v.trim() : undefined;
    return {
      ...o,
      // Coerce números a string para `number` (algunos LLMs devuelven 7 en vez de "7")
      number: typeof o.number === 'number' ? String(o.number) : trim(o.number),
      line1: trim(o.line1),
      line2: trim(o.line2),
      caption: trim(o.caption),
    };
  });

  const valid = normalized
    .map((s) => GeneratedSlideSchema.safeParse(s))
    .filter((r): r is { success: true; data: GeneratedSlide } => r.success)
    .map((r) => r.data);
  if (valid.length === 0) throw new Error('Ninguna slide del array pasó validación básica');
  return valid;
}

/**
 * Si la respuesta es un objeto envoltorio típico (`{slides:[...]}`,
 * `{data:[...]}`, etc.), devuelve el array adentro. Si no, devuelve undefined
 * y dejamos que el caller pruebe el siguiente camino.
 */
function tryParseEnvelope(raw: string): unknown[] | undefined {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  if (!cleaned.startsWith('{')) return undefined;
  // Encontrar el cierre del objeto top-level (matching brace).
  // Heurística simple: si el primer parse falla, intentamos cortar hasta el
  // último `}` razonable.
  try {
    const obj = JSON.parse(cleaned);
    return pickArrayFromEnvelope(obj);
  } catch {
    // Intento 2: cortar desde el primer `{` hasta el último `}`
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return undefined;
    try {
      const obj = JSON.parse(cleaned.slice(start, end + 1));
      return pickArrayFromEnvelope(obj);
    } catch {
      return undefined;
    }
  }
}

function pickArrayFromEnvelope(obj: unknown): unknown[] | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  for (const key of ['slides', 'data', 'result', 'carousel', 'items']) {
    if (Array.isArray(o[key])) return o[key] as unknown[];
  }
  return undefined;
}
