/**
 * Prompt compartido por todos los providers. Mismo criterio editorial
 * independientemente de si corre en Anthropic, Groq, Gemini u Ollama.
 */
export function buildCarouselPrompt(topic: string, count: number, lang: 'es' | 'en'): string {
  if (lang === 'en') {
    return `You write cold, sharp social-media carousels. No LinkedIn-influencer tone.

Write an Instagram carousel of ${count} slides about: "${topic}"

STRUCTURE (always ${count} items in this order when possible):
1. "cover"       — hook, 5–9 words
2. "observation" — conversational thought, 15–22 words
3. "contrast"    — claim (11–15 w) + contrast counter (6–9 w)
4. "quote"       — central insight, 10–16 words
5. "stat"        — number + caption (10–16 w). If unsure of real source, use "7 of 10" with caption "INTERNAL · STUDIO"
6. "cta"         — line1 (8–12 w) + line2 short action (max 6 w)

Rules: concrete > abstract, vary rhythm, ban words: synergy, engagement, disruption, hashtags, emojis.

Reply ONLY a JSON array of ${count} objects with shape {"type":string,"line1":string,"line2"?:string,"number"?:string,"caption"?:string}. No prose.`;
  }
  return `Escribís carruseles frescos, concretos, sin tono de motivador de LinkedIn.

Carrusel de Instagram de ${count} slides sobre: "${topic}"

ESTRUCTURA (en este orden cuando aplica):
1. "cover"       — hook 5-9 palabras
2. "observation" — pensamiento conversacional 15-22 palabras
3. "contrast"    — afirmación 11-15 palabras + contraste 6-9 palabras
4. "quote"       — insight central 10-16 palabras
5. "stat"        — número + caption 10-16 palabras. Si no hay fuente real: "7 de 10" con caption "OBSERVACIÓN INTERNA"
6. "cta"         — line1 8-12 palabras + line2 acción corta máx 6 palabras

Reglas: concreto > abstracto, variá ritmo, prohibido: sinergia, engagement, disrupción, hashtags, emojis.

Respondé SOLO un JSON array de ${count} objetos con shape {"type":string,"line1":string,"line2"?:string,"number"?:string,"caption"?:string}. Sin prosa.`;
}

export function extractJsonArray(raw: string): string {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return cleaned;
  return cleaned.slice(start, end + 1);
}
