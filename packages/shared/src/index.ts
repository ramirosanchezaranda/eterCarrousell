/**
 * @carrousel/shared — schemas y utilidades compartidas entre frontend (apps/web)
 * y BFF (apps/bff). Validan input/output de /api/generate.
 */
import { z } from 'zod';

export const SHARED_VERSION = '0.4.0' as const;

export const SlideTypeSchema = z.enum(['cover', 'contrast', 'observation', 'quote', 'stat', 'cta']);
export type SlideType = z.infer<typeof SlideTypeSchema>;

/**
 * Schema permisivo: permite que slides parcialmente correctas pasen el filtro
 * inicial. La validación contractual estricta (line2 requerido para contrast,
 * number requerido para stat, etc.) se hace después con `validateSlideContract`
 * y dispara el pipeline de reparación si falla.
 *
 * Lo dejamos permisivo aposta porque consumidores río abajo (renderer, store,
 * `mergeGeneratedTexts`) ya tratan los campos extra como opcionales.
 */
export const GeneratedSlideSchema = z.object({
  type: SlideTypeSchema,
  line1: z.string().min(1),
  line2: z.string().optional(),
  number: z.string().optional(),
  caption: z.string().optional(),
});

export const GenerateRequestSchema = z.object({
  topic: z.string().min(3).max(500),
  count: z.number().int().min(3).max(10).default(6),
  language: z.enum(['es', 'en']).default('es'),
});

export const GenerateResponseSchema = z.object({
  slides: z.array(GeneratedSlideSchema).min(1),
});

export type GeneratedSlide = z.infer<typeof GeneratedSlideSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

// =============================================================================
// CONTRATO POR TIPO DE SLIDE
//
// El prompt promete una forma exacta por slot. Cuando un LLM débil (Llama 3.2,
// Mistral-small, Gemini-Flash) se desvía, lo detectamos acá con reglas
// declarativas y disparamos reparación selectiva (solo los slots rotos).
// =============================================================================

export interface SlideContract {
  /** Campos string requeridos además de `type`. */
  required: ReadonlyArray<'line1' | 'line2' | 'number' | 'caption'>;
  /** Rangos de palabras [min, max] por campo. `undefined` = sin chequeo. */
  wordRange: Partial<Record<'line1' | 'line2', readonly [number, number]>>;
  /** Rol semántico del slot (informativo, usado por el repair prompt). */
  role: string;
}

export const SLIDE_CONTRACTS: Record<SlideType, SlideContract> = {
  cover: {
    required: ['line1'],
    wordRange: { line1: [3, 9] }, // 4-8 con tolerancia ±1
    role: 'Título principal del carrusel (tapa de revista). Debe derivarse del tema.',
  },
  observation: {
    required: ['line1'],
    wordRange: { line1: [15, 40] }, // 20-35 con tolerancia
    role: 'Subtítulo / bajada que expande la tapa con contexto sobre el tema.',
  },
  contrast: {
    required: ['line1', 'line2'],
    wordRange: { line1: [9, 17], line2: [4, 11] },
    role: 'Afirmación + contra-afirmación con estructura paralela sobre el tema.',
  },
  quote: {
    required: ['line1'],
    wordRange: { line1: [8, 18] },
    role: 'Insight central, primera persona o impersonal, sobre el tema.',
  },
  stat: {
    required: ['line1', 'number'],
    wordRange: { line1: [4, 14] },
    role: 'Dato cuantitativo y descripción corta del dato.',
  },
  cta: {
    required: ['line1', 'line2'],
    wordRange: { line1: [6, 14], line2: [1, 7] },
    role: 'Llamada a la acción larga + acción corta.',
  },
};

/** Estructura por defecto de un carrusel de 6 slides. */
export const DEFAULT_SLIDE_ORDER: ReadonlyArray<SlideType> = [
  'cover',
  'observation',
  'contrast',
  'quote',
  'stat',
  'cta',
] as const;

/** Frases prohibidas (case-insensitive). Detectadas → slide marcada para reparación. */
export const BANNED_PHRASES: ReadonlyArray<string> = [
  'sinergia',
  'synergy',
  'engagement',
  'disrupción',
  'disrupcion',
  'disruption',
  // Plantillas genéricas que aparecen cuando el LLM no entiende el topic
  'this carousel',
  'este carrusel',
  'interesting topic',
  'tema interesante',
];

/** Devuelve un array de palabras (cuenta cada token alfanumérico). */
export function countWords(s: string | undefined): number {
  if (!s) return 0;
  const tokens = s.trim().match(/[\p{L}\p{N}]+/gu);
  return tokens ? tokens.length : 0;
}

export interface SlideContractIssue {
  slot: number; // índice 0-based en el array
  type: SlideType;
  reasons: string[];
}

/**
 * Valida una slide contra su contrato. Devuelve `null` si pasa, o una lista
 * de razones legibles (en español) si falla. Las razones se usan en el
 * `repair` prompt para que el LLM sepa qué fix aplicar.
 */
export function validateSlideContract(
  slide: Partial<GeneratedSlide> | null | undefined,
  expectedType?: SlideType,
): string[] | null {
  if (!slide || typeof slide !== 'object') return ['slide vacía o no es objeto'];
  const reasons: string[] = [];
  const type = slide.type;
  if (!type || !SlideTypeSchema.safeParse(type).success) {
    reasons.push(`type inválido: "${String(type)}"`);
    return reasons;
  }
  if (expectedType && type !== expectedType) {
    reasons.push(`type esperado "${expectedType}", recibido "${type}"`);
  }
  const contract = SLIDE_CONTRACTS[type as SlideType];
  for (const field of contract.required) {
    const value = (slide as Record<string, unknown>)[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      reasons.push(`falta campo "${field}"`);
    }
  }
  for (const [field, range] of Object.entries(contract.wordRange)) {
    if (!range) continue;
    const value = (slide as Record<string, unknown>)[field];
    if (typeof value !== 'string' || value.trim().length === 0) continue; // ya capturado arriba
    const n = countWords(value);
    const [min, max] = range;
    if (n < min) reasons.push(`${field} tiene ${n} palabras, mínimo ${min}`);
    if (n > max) reasons.push(`${field} tiene ${n} palabras, máximo ${max}`);
  }
  // Frases prohibidas
  const haystack = [slide.line1, slide.line2, slide.number, slide.caption]
    .filter((v): v is string => typeof v === 'string')
    .join(' \n ')
    .toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase.toLowerCase())) {
      reasons.push(`contiene frase prohibida "${phrase}"`);
    }
  }
  return reasons.length > 0 ? reasons : null;
}

// =============================================================================
// ANCLAJE AL TOPIC
//
// Un LLM débil puede devolver 6 slides perfectamente formateadas pero hablando
// de OTRA cosa. Este anclaje verifica que al menos cover + observation
// contengan algún token del topic (después de stripear stopwords y diacríticos).
// =============================================================================

const STOPWORDS_ES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'a', 'en', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'hacia', 'hasta',
  'desde', 'que', 'cual', 'quien', 'cuyo', 'donde', 'cuando', 'como', 'porque',
  'pues', 'si', 'no', 'ni', 'o', 'u', 'y', 'e', 'pero', 'mas', 'sino', 'aunque',
  'es', 'son', 'fue', 'sea', 'ser', 'estar', 'esta', 'estan', 'esto', 'esa',
  'ese', 'eso', 'esos', 'esas', 'aquel', 'aquella', 'aquello', 'mi', 'tu', 'su',
  'me', 'te', 'se', 'le', 'lo', 'nos', 'os', 'les', 'mio', 'tuyo', 'suyo',
  'muy', 'mas', 'menos', 'tan', 'tanto', 'todo', 'toda', 'todos', 'todas',
  'algo', 'nada', 'alguien', 'nadie', 'cada',
]);
const STOPWORDS_EN = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'while',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
  'have', 'has', 'had', 'of', 'in', 'on', 'at', 'by', 'for', 'to', 'from',
  'with', 'without', 'about', 'into', 'over', 'under', 'between', 'this',
  'that', 'these', 'those', 'it', 'its', 'as', 'so', 'than', 'too', 'very',
  'can', 'will', 'just', 'should', 'now',
]);

/** Quita diacríticos (NFD + strip combining marks). */
export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Tokeniza un texto para anclaje al topic: lowercase, sin diacríticos,
 * sin stopwords, sin tokens de menos de 4 caracteres (los chicos generan
 * demasiado ruido — "el", "y", "of"). Retorna tokens únicos.
 */
export function tokenizeForAnchor(text: string, lang: 'es' | 'en' = 'es'): string[] {
  const stop = lang === 'en' ? STOPWORDS_EN : STOPWORDS_ES;
  const norm = stripDiacritics(text.toLowerCase());
  const matches = norm.match(/[a-z0-9]+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of matches) {
    if (tok.length < 4) continue;
    if (stop.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

/**
 * ¿La slide menciona al menos uno de los tokens del topic? Compara contra
 * todos los campos de texto. Si el topic no produce tokens útiles
 * (ej: topic muy corto o todo stopwords), retorna `true` para no falsear.
 */
export function isSlideOnTopic(
  slide: Partial<GeneratedSlide> | null | undefined,
  topicTokens: ReadonlyArray<string>,
): boolean {
  if (topicTokens.length === 0) return true;
  if (!slide) return false;
  const haystack = stripDiacritics(
    [slide.line1, slide.line2, slide.number, slide.caption]
      .filter((v): v is string => typeof v === 'string')
      .join(' ')
      .toLowerCase(),
  );
  return topicTokens.some((tok) => haystack.includes(tok));
}
