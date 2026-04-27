/**
 * Prompts compartidos por todos los providers. Mismo criterio editorial,
 * mismo contrato JSON, sin importar si corre en Anthropic, Groq, Gemini u Ollama.
 *
 * Diseño:
 *   - `system`: rol + reglas absolutas + forma JSON exacta + un ejemplo
 *     completo (few-shot). Esto es lo que mantiene a un LLM débil dentro
 *     del riel: cuando duda, copia la forma del ejemplo.
 *   - `user`: solo el topic + idioma + count. Lo más corto posible.
 *   - `repair`: pide ÚNICAMENTE los slots rotos (no regenera todo). Conserva
 *     las slides ya válidas y reemplaza las que fallaron contrato/anclaje.
 *
 * El output siempre se le pide envuelto en `{"slides":[...]}` (objeto top-level)
 * porque eso permite usar `response_format: {type: "json_object"}` en
 * OpenAI/Groq/Mistral, `format: "json"` en Ollama, y `responseMimeType:
 * "application/json"` en Gemini. El parser acepta también el array desnudo
 * por compatibilidad con respuestas legacy.
 */
import type { SlideType } from '@carrousel/shared';

// =============================================================================
// FEW-SHOT EXAMPLE
// Un ejemplo completo, sobre un topic neutral. Se incrusta en el system prompt.
// =============================================================================

const EXAMPLE_TOPIC_ES = 'Diseño de portadas para Instagram';
const EXAMPLE_OUTPUT_ES = `{
  "slides": [
    { "type": "cover",       "line1": "Portadas que frenan el scroll" },
    { "type": "observation", "line1": "La primera imagen decide si el usuario se queda o pasa. La atención es un recurso escaso, los primeros dos segundos definen todo el carrusel." },
    { "type": "contrast",    "line1": "La mayoría diseña portadas para gustarse a sí misma, no al lector", "line2": "El lector decide en dos segundos." },
    { "type": "quote",       "line1": "Una portada no se diseña, se edita: cada elemento ahí ya pasó por una negociación." },
    { "type": "stat",        "number": "7 de 10", "line1": "carruseles pierden al lector en la portada", "caption": "OBSERVACIÓN INTERNA · ETERCORE" },
    { "type": "cta",         "line1": "Si tu portada no gana en dos segundos, perdió el carrusel entero", "line2": "Probá con una sola palabra." }
  ]
}`;

const EXAMPLE_TOPIC_EN = 'Designing Instagram covers';
const EXAMPLE_OUTPUT_EN = `{
  "slides": [
    { "type": "cover",       "line1": "Covers that stop the scroll" },
    { "type": "observation", "line1": "The first image decides whether the viewer stays or swipes. Attention is a scarce resource and the first two seconds define the rest of the carousel." },
    { "type": "contrast",    "line1": "Most people design covers to please themselves, not the reader", "line2": "Readers decide in two seconds." },
    { "type": "quote",       "line1": "A cover is not designed, it is edited: every element earned its place in a negotiation." },
    { "type": "stat",        "number": "7 of 10", "line1": "carousels lose the reader on the cover", "caption": "INTERNAL · STUDIO" },
    { "type": "cta",         "line1": "If your cover does not win in two seconds, it lost the whole carousel", "line2": "Try a single word." }
  ]
}`;

// =============================================================================
// SYSTEM PROMPT (riel rígido)
// =============================================================================

export function buildSystemPrompt(lang: 'es' | 'en'): string {
  if (lang === 'en') {
    return `You are the senior copywriter for eterCore, a LATAM web design studio. You write sharp Instagram carousels in a magazine-editorial tone — like a smart friend at a café, never LinkedIn-influencer. No emojis. No hashtags. No motivational fluff.

ABSOLUTE RULES:
1. Reply ONLY with a single JSON object of shape {"slides": [...]}. No prose. No markdown fences. No explanation. No comments.
2. The "slides" array MUST contain EXACTLY the requested number of objects, in EXACTLY this order: cover, observation, contrast, quote, stat, cta. Do not invent new types. Do not skip types.
3. Every "line1" is a non-empty string with no leading or trailing whitespace.
4. Every slide MUST mention or relate to the user-provided topic. Do not switch subjects.
5. Banned words: synergy, engagement, disruption. Banned characters: emojis, hashtags. Concrete > abstract.

PER-SLIDE CONTRACT (strict):

  cover
    line1 = MAIN TITLE of the carousel, 4-8 words, derived from the topic. Reads like a magazine cover. Never empty, never generic.

  observation
    line1 = SUBTITLE / DECK that expands the title and gives context, 20-35 words. Mentions the topic.

  contrast
    line1 = claim, 11-15 words.
    line2 = counter-statement, 6-9 words. Parallel structure to line1. REQUIRED.

  quote
    line1 = central insight, 10-16 words. First-person or impersonal voice.

  stat
    number = a number or ratio, e.g. "7 of 10" or "42%". REQUIRED. If no real source, use "7 of 10".
    line1 = description of the stat, 6-12 words.
    caption = "INTERNAL · STUDIO" when no real source is cited. REQUIRED if "number" was made up.

  cta
    line1 = call-to-action, 8-12 words.
    line2 = short action, MAX 6 words. REQUIRED.

EXAMPLE — for topic "${EXAMPLE_TOPIC_EN}", you would reply EXACTLY:
${EXAMPLE_OUTPUT_EN}

Now wait for the user's topic and answer with the same shape, but writing about THEIR topic.`;
  }

  return `Sos el copywriter senior de eterCore, agencia de diseño web en LATAM. Escribís carruseles de Instagram en tono editorial de revista — como un amigo inteligente en un café, nunca motivador de LinkedIn. Sin emojis. Sin hashtags. Nada de palabrería motivacional.

REGLAS ABSOLUTAS:
1. Respondé SOLO con un único objeto JSON con forma {"slides": [...]}. Sin prosa. Sin fences de markdown. Sin explicación. Sin comentarios.
2. El array "slides" debe contener EXACTAMENTE la cantidad pedida de objetos, en EXACTAMENTE este orden: cover, observation, contrast, quote, stat, cta. No inventes tipos nuevos. No te saltees tipos.
3. Cada "line1" es un string no vacío, sin espacios al borde.
4. Cada slide DEBE mencionar o relacionarse con el tema dado por el usuario. No cambies de tema.
5. Palabras prohibidas: sinergia, engagement, disrupción. Caracteres prohibidos: emojis, hashtags. Concreto > abstracto.

CONTRATO POR SLIDE (estricto):

  cover
    line1 = TÍTULO PRINCIPAL del carrusel, 4-8 palabras, derivado del tema. Se lee como tapa de revista. Nunca vacío, nunca genérico.

  observation
    line1 = SUBTÍTULO / BAJADA que expande el título y da contexto, 20-35 palabras. Menciona el tema.

  contrast
    line1 = afirmación, 11-15 palabras.
    line2 = contra-afirmación, 6-9 palabras. Estructura paralela a line1. OBLIGATORIO.

  quote
    line1 = insight central, 10-16 palabras. Voz en primera persona o impersonal.

  stat
    number = número o proporción, ej. "7 de 10" o "42%". OBLIGATORIO. Si no hay fuente real, usá "7 de 10".
    line1 = descripción del dato, 6-12 palabras.
    caption = "OBSERVACIÓN INTERNA · ETERCORE" cuando el "number" es inventado. OBLIGATORIO si no hay fuente real.

  cta
    line1 = llamada a la acción, 8-12 palabras.
    line2 = acción corta, MÁX 6 palabras. OBLIGATORIO.

EJEMPLO — para el tema "${EXAMPLE_TOPIC_ES}", responderías EXACTAMENTE:
${EXAMPLE_OUTPUT_ES}

Ahora esperá el tema del usuario y respondé con la misma forma, pero escribiendo sobre SU tema.`;
}

// =============================================================================
// USER PROMPT (solo el topic, lo más corto posible)
// =============================================================================

export function buildUserPrompt(topic: string, count: number, lang: 'es' | 'en'): string {
  if (lang === 'en') {
    return `Topic: "${topic}"\nLanguage: English\nNumber of slides: ${count}\n\nReply ONLY with the JSON object {"slides":[...]} — ${count} slides about THIS topic, in the order cover → observation → contrast → quote → stat → cta.`;
  }
  return `Tema: "${topic}"\nIdioma: español\nCantidad de slides: ${count}\n\nRespondé SOLO con el objeto JSON {"slides":[...]} — ${count} slides sobre ESTE tema, en el orden cover → observation → contrast → quote → stat → cta.`;
}

/**
 * Para providers que no tienen system role separado (Gemini, Ollama nativo,
 * Anthropic) o cuando preferimos un único string. Concatena system + user.
 */
export function buildCarouselPrompt(topic: string, count: number, lang: 'es' | 'en'): string {
  return `${buildSystemPrompt(lang)}\n\n---\n\n${buildUserPrompt(topic, count, lang)}`;
}

// =============================================================================
// REPAIR PROMPT (solo los slots rotos)
// =============================================================================

export interface RepairSlot {
  /** Índice 0-based en el array original. */
  slot: number;
  /** Tipo esperado para ese slot. */
  type: SlideType;
  /** Razones por las que la slide previa no pasó. Se las pasamos al LLM. */
  reasons: string[];
}

/**
 * Genera un prompt corto pidiendo SOLO los slots rotos. Las razones se
 * incluyen para que el LLM aplique fix (ej: "line2 falta", "line1 tiene
 * 2 palabras, mínimo 9").
 */
export function buildRepairPrompt(
  topic: string,
  slots: ReadonlyArray<RepairSlot>,
  lang: 'es' | 'en',
): string {
  const sys = buildSystemPrompt(lang);
  const slotLines = slots
    .map((s) => {
      const reasons = s.reasons.length > 0 ? ` (razones: ${s.reasons.join('; ')})` : '';
      return `  - slot ${s.slot} → type "${s.type}"${reasons}`;
    })
    .join('\n');

  if (lang === 'en') {
    return `${sys}\n\n---\n\nTopic: "${topic}"\nLanguage: English\n\nThe previous response failed for these slots and ONLY these slots. Re-send ONLY them, with the same shape {"slides":[...]} but containing exactly ${slots.length} object(s) in slot order:\n${slotLines}\n\nDo not return the slots that already passed. Stay strictly within the per-slide contract above and stay on the topic.`;
  }
  return `${sys}\n\n---\n\nTema: "${topic}"\nIdioma: español\n\nLa respuesta anterior falló SOLO en estos slots. Devolvé ÚNICAMENTE esos slots, con la misma forma {"slides":[...]} pero conteniendo exactamente ${slots.length} objeto(s) en el mismo orden:\n${slotLines}\n\nNo devuelvas los slots que ya pasaron. Mantenete estricto dentro del contrato por slide de arriba y dentro del tema.`;
}

// =============================================================================
// PARSEO TOLERANTE
// =============================================================================

/**
 * Extrae el array de slides desde la respuesta cruda del LLM. Acepta:
 *   - array desnudo `[...]`
 *   - objeto `{"slides":[...]}` (forma canónica del nuevo prompt)
 *   - objeto `{"data":[...]}`, `{"result":[...]}`, `{"carousel":[...]}` (LLMs caprichosos)
 *   - texto envuelto en fences ```json ... ```
 *   - basura antes/después del JSON
 *
 * Retorna el JSON string del ARRAY (no del objeto), listo para `JSON.parse`.
 * Si no encuentra nada parseable, retorna el original limpio (que probablemente
 * fallará el parse río abajo, donde tiramos un error legible).
 */
export function extractJsonArray(raw: string): string {
  let cleaned = raw.replace(/```json|```/g, '').trim();

  // Si arranca con `{` puede ser {"slides":[...]} — extraemos el array que esté adentro.
  if (cleaned.startsWith('{')) {
    // Buscamos el primer `[` y el último `]` correspondiente — el array más grande
    // suele ser el de slides. Heurística simple pero efectiva.
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      return cleaned.slice(start, end + 1);
    }
  }

  // Caso array desnudo o texto con array adentro.
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) {
    // Último recurso: si es objeto JSON, devolverlo tal cual (parser lo manejará).
    return cleaned;
  }
  return cleaned.slice(start, end + 1);
}
