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

/** Corta texto en líneas respetando un máximo de caracteres por línea. */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current);
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
