/**
 * Prompt compartido por todos los providers. Mismo criterio editorial
 * independientemente de si corre en Anthropic, Groq, Gemini u Ollama.
 *
 * Regla de oro de este prompt:
 *   - Slide 1 (cover) = TÍTULO principal del carrusel. NO es un hook
 *     abstracto: es el título que dejaría claro el tema al lector de un
 *     vistazo (tipo portada de revista), 4-8 palabras.
 *   - Slide 2 (observation) = SUBTÍTULO / PÁRRAFO que expande el título y
 *     da contexto. Es lo que en una revista sería la bajada. 20-35 palabras.
 *   - Resto: contrast / quote / stat / cta con roles definidos.
 *
 * El LLM a veces devuelve `line1` vacío o genérico. Esta versión del prompt
 * incluye ejemplos explícitos para minimizar ese caso, y el parser en
 * `openaiCompat.ts` limpia strings vacíos como defensa adicional.
 */
export function buildCarouselPrompt(topic: string, count: number, lang: 'es' | 'en'): string {
  if (lang === 'en') {
    return `You write sharp social-media carousels in a magazine-editorial tone. No LinkedIn-influencer tone, no emojis, no hashtags.

Write an Instagram carousel of ${count} slides about: "${topic}"

REQUIRED STRUCTURE (always follow this order):

1. type: "cover"
   line1: MAIN TITLE of the carousel — 4-8 words, derived from the topic. Reads like a magazine cover. Must NOT be empty or generic. Example: for topic "Designing Instagram covers", line1 could be "Covers that stop the scroll".

2. type: "observation"
   line1: SUBTITLE / PARAGRAPH that expands the title and gives context. 20-35 words. Acts as the "deck" of the piece. Example: "The first image decides whether the viewer stays or swipes. Attention is a scarce resource — make the first 2 seconds count."

3. type: "contrast"
   line1: claim, 11-15 words.
   line2: counter-statement, 6-9 words (parallel structure).

4. type: "quote"
   line1: central insight, 10-16 words.

5. type: "stat"
   number: a number or ratio (e.g. "7 of 10"). If no verifiable source, use "7 of 10".
   line1: description of the stat, 6-12 words.
   caption: "INTERNAL · STUDIO" when no real source is cited.

6. type: "cta"
   line1: call-to-action in 8-12 words.
   line2: short action, MAX 6 words.

BANNED: synergy, engagement, disruption, hashtags, emojis. Concrete > abstract. Vary rhythm.

Reply ONLY with a JSON array of exactly ${count} objects, each with shape:
{"type": string, "line1": string (non-empty, no leading/trailing whitespace), "line2"?: string, "number"?: string, "caption"?: string}

No prose, no markdown fences, no explanation.`;
  }
  return `Escribís carruseles de Instagram en tono editorial de revista. Nada de motivador de LinkedIn, nada de emojis, nada de hashtags.

Carrusel de Instagram de ${count} slides sobre: "${topic}"

ESTRUCTURA OBLIGATORIA (siempre en este orden):

1. type: "cover"
   line1: TÍTULO PRINCIPAL del carrusel — 4-8 palabras, derivado del tema. Se lee como tapa de revista. NO puede quedar vacío ni ser genérico. Ejemplo: para el tema "Diseño de portadas para Instagram", line1 podría ser "Portadas que frenan el scroll".

2. type: "observation"
   line1: SUBTÍTULO / PÁRRAFO que expande el título y da contexto. 20-35 palabras. Funciona como la bajada de la tapa. Ejemplo: "La primera imagen decide si el usuario se queda o pasa. La atención es un recurso escaso — los primeros 2 segundos son todo."

3. type: "contrast"
   line1: afirmación, 11-15 palabras.
   line2: contra-afirmación, 6-9 palabras (estructura paralela).

4. type: "quote"
   line1: insight central, 10-16 palabras.

5. type: "stat"
   number: número o proporción (ej. "7 de 10"). Si no hay fuente verificable, usá "7 de 10".
   line1: descripción del dato, 6-12 palabras.
   caption: "OBSERVACIÓN INTERNA · ETERCORE" cuando no hay fuente real.

6. type: "cta"
   line1: llamada a la acción, 8-12 palabras.
   line2: acción corta, MÁX 6 palabras.

PROHIBIDO: sinergia, engagement, disrupción, hashtags, emojis. Concreto > abstracto. Variá el ritmo.

Respondé SOLO un JSON array de exactamente ${count} objetos, cada uno con forma:
{"type": string, "line1": string (no vacío, sin espacios al borde), "line2"?: string, "number"?: string, "caption"?: string}

Sin prosa, sin fences markdown, sin explicación.`;
}

export function extractJsonArray(raw: string): string {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return cleaned;
  return cleaned.slice(start, end + 1);
}
