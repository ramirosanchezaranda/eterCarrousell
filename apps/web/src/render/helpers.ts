/**
 * Helpers puros usados por primitivos SVG y slides. Sin DOM, sin React.
 */
import type { BrandAssets } from '@/domain';

/** LCG determinístico simple — misma seed → misma secuencia. */
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Corta texto en líneas respetando un máximo de caracteres por línea.
 *
 * Trata los `\n` del input como SALTOS DE LÍNEA DUROS (lo que escribió el
 * usuario manualmente) y además wrapea por ancho cada segmento si supera
 * `maxChars`. Antes esto era un solo `split(' ')` plano: si el usuario
 * insertaba un `\n`, todo el texto después del `\n` se metía en una sola
 * "palabra" gigante y la línea explotaba el bbox.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const result: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.length === 0) {
      result.push(''); // párrafo vacío = línea en blanco intencional
      continue;
    }
    const words = para.split(' ');
    let current = '';
    for (const w of words) {
      if ((current + ' ' + w).trim().length > maxChars) {
        if (current) result.push(current.trim());
        current = w;
      } else {
        current = (current + ' ' + w).trim();
      }
    }
    if (current) result.push(current);
  }
  return result;
}

/**
 * Igual que `wrapText` pero devuelve además los índices [start, end) de
 * cada línea dentro del string original. Se usa para wrapear texto que
 * tiene `runs` (bold/italic/subrayado por partes): con las posiciones
 * podemos partir los runs en segmentos que respeten el wrap visual y
 * a la vez mantengan el formato original por caracter.
 *
 * Los índices son sobre la `text` original (incluyendo los espacios que
 * eventualmente quedan trimmeados al emitirse la línea). De esa forma el
 * `end` de la línea N coincide (± espacio) con el `start` de la N+1 y
 * no se pierde contenido al distribuir los runs.
 */
export interface WrappedLine {
  text: string;
  start: number;
  end: number;
}
export function wrapTextWithRanges(text: string, maxChars: number): WrappedLine[] {
  const lines: WrappedLine[] = [];
  const n = text.length;
  let lineStart = 0;
  let currentEnd = 0;   // posición después de la última palabra incluida
  let currentLen = 0;
  let i = 0;
  const flush = (endIdx: number) => {
    if (currentLen > 0) {
      // Trim trailing whitespace del contenido visible
      const raw = text.slice(lineStart, endIdx);
      lines.push({ text: raw.trim(), start: lineStart, end: endIdx });
      lineStart = endIdx;
      currentLen = 0;
    }
  };
  while (i < n) {
    // Salto de línea duro: cierra la línea actual y arranca otra.
    // Conservamos los rangos para que distributeRunsByRanges no pierda chars.
    if (text[i] === '\n') {
      if (currentLen > 0) {
        flush(currentEnd);
      } else {
        // Línea en blanco intencional: empuja una línea vacía con rango cero.
        lines.push({ text: '', start: i, end: i });
      }
      i++;
      lineStart = i;
      continue;
    }
    // Saltear espacios al inicio de línea y mover lineStart
    if (currentLen === 0) {
      while (i < n && text[i] === ' ') { i++; lineStart = i; }
    }
    // Leer la próxima palabra (frena en espacio o \n)
    const wordStart = i;
    while (i < n && text[i] !== ' ' && text[i] !== '\n') i++;
    const word = text.slice(wordStart, i);
    if (!word) continue;
    const sep = currentLen > 0 ? 1 : 0; // espacio antes de la palabra
    if (currentLen + sep + word.length > maxChars && currentLen > 0) {
      flush(currentEnd);
      // La palabra arranca esta nueva línea
      lineStart = wordStart;
      currentLen = word.length;
      currentEnd = i;
    } else {
      currentLen += sep + word.length;
      currentEnd = i;
    }
    // Consumir un espacio después, si hay
    if (i < n && text[i] === ' ') i++;
  }
  flush(n);
  return lines;
}

/**
 * Decide qué imagen decor usar para una slide dada. Alterna entre A y B
 * según el índice de slide (pares → A, impares → B). Si solo hay una
 * disponible, siempre devuelve esa.
 */
export function pickDecor(assets: BrandAssets, slideIndex: number): string | null {
  const { decorA: a, decorB: b } = assets;
  if (!a && !b) return null;
  if (a && !b) return a;
  if (!a && b) return b;
  return slideIndex % 2 === 0 ? a : b;
}
