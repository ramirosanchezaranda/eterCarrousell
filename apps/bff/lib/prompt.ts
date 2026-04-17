export function buildPrompt(topic: string, count: number, lang: 'es' | 'en'): string {
  if (lang === 'en') {
    return `You are the senior copywriter for eterCore, a LATAM web design agency.\n\nWrite an Instagram carousel of ${count} slides about: "${topic}"\n\nReturn ONLY a JSON array with objects of shape {type, line1, line2?, number?, caption?}.`;
  }
  return `Sos el copywriter senior de eterCore, agencia de diseño web en LATAM. Tono de amigo inteligente en un café, no motivador de LinkedIn.

Carrusel de Instagram de ${count} slides sobre: "${topic}"

ESTRUCTURA:
1. "cover" — hook de 5-9 palabras
2. "observation" — pensamiento conversacional 15-22 palabras
3. "contrast" — afirmación 11-15 palabras + contraste 6-9 palabras (único con paralelismo)
4. "quote" — insight central 10-16 palabras
5. "stat" — número con caption 10-16 palabras. Si no hay dato verificable: "7 de 10" con caption "OBSERVACIÓN INTERNA · ETERCORE". Nunca inventes fuentes reales.
6. "cta" — line1 8-12 palabras + line2 acción corta máx 6 palabras

Concreto > abstracto. Variá ritmo. Prohibido: sinergia, engagement, disrupción, hashtags, emojis.

SOLO JSON array con ${count} objetos de forma {type, line1, line2?, number?, caption?}.`;
}
