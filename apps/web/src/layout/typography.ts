/**
 * Tipografía con medición real (canvas 2d context). Implementa wrap por
 * ancho en pixeles y fitFontSize por binary search — mucho más preciso
 * que estimar por caracteres.
 */
import type { Rect } from '@/domain';

let measureCtx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D {
  if (measureCtx) return measureCtx;
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context not available for typography measurement');
  measureCtx = ctx;
  return ctx;
}

export interface FontSpec {
  family: string;
  size: number;
  weight?: number;
  style?: 'normal' | 'italic';
  letterSpacing?: number;
}

function applyFont(ctx: CanvasRenderingContext2D, font: FontSpec): void {
  const style = font.style ?? 'normal';
  const weight = font.weight ?? 400;
  ctx.font = `${style} ${weight} ${font.size}px ${font.family}`;
}

export function measureWidth(text: string, font: FontSpec): number {
  const ctx = getCtx();
  applyFont(ctx, font);
  const base = ctx.measureText(text).width;
  const spacing = (font.letterSpacing ?? 0) * Math.max(0, text.length - 1);
  return base + spacing;
}

/**
 * Wrap por ancho en pixeles. Devuelve las líneas resultantes.
 * Si una sola palabra excede el ancho, se coloca sola (overflow visual).
 */
export function wrapLines(text: string, maxWidth: number, font: FontSpec): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? current + ' ' + w : w;
    if (measureWidth(candidate, font) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface FitResult {
  fontSize: number;
  lines: string[];
  totalHeight: number;
}

/**
 * Encuentra el fontSize más grande entre [min, max] tal que el texto
 * wrapeado entre en el rect con lineHeight dado. Binary search 14 pasos.
 */
export function fitFontSize(
  text: string,
  rect: Rect,
  font: Omit<FontSpec, 'size'>,
  range: { min: number; max: number; preferred?: number },
  lineHeight = 1.15,
): FitResult {
  const max = range.max;
  const min = range.min;
  // Intentar preferred primero
  if (range.preferred !== undefined) {
    const r = tryFit(text, rect, { ...font, size: range.preferred }, lineHeight);
    if (r.fits) return { fontSize: range.preferred, lines: r.lines, totalHeight: r.totalHeight };
  }
  let lo = min, hi = max, best: FitResult = { fontSize: min, lines: [text], totalHeight: min * lineHeight };
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const r = tryFit(text, rect, { ...font, size: mid }, lineHeight);
    if (r.fits) {
      best = { fontSize: mid, lines: r.lines, totalHeight: r.totalHeight };
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

function tryFit(text: string, rect: Rect, font: FontSpec, lineHeight: number): { fits: boolean; lines: string[]; totalHeight: number } {
  const lines = wrapLines(text, rect.w, font);
  const totalHeight = lines.length * font.size * lineHeight;
  return { fits: totalHeight <= rect.h, lines, totalHeight };
}
