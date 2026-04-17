/**
 * Contraste WCAG — funciones puras para:
 *   1. Calcular luminancia relativa de un color (sRGB → linear → Y).
 *   2. Calcular ratio de contraste entre dos colores.
 *   3. Elegir el color de texto más legible contra un fondo dado.
 *   4. Calcular el overlay mínimo para alcanzar un ratio target.
 *
 * Todas las funciones operan sobre strings hex (#RGB o #RRGGBB).
 */

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, '');
  let full = clean;
  if (clean.length === 3) {
    full = clean.split('').map((c) => c + c).join('');
  }
  if (full.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Devuelve el color más legible contra `bg` entre los candidatos. */
export function pickReadableColor(bg: string, candidates: string[] = ['#FFFFFF', '#000000']): string {
  let best = candidates[0] ?? '#FFFFFF';
  let bestRatio = 0;
  for (const c of candidates) {
    const r = contrastRatio(bg, c);
    if (r > bestRatio) { best = c; bestRatio = r; }
  }
  return best;
}

/**
 * Calcula el alpha mínimo de un overlay de color sólido sobre `bg` para
 * alcanzar el `target` contra `textColor`. Devuelve null si no hay overlay
 * que alcance el ratio.
 */
export function computeOverlayForRatio(
  bg: string,
  textColor: string,
  overlayColor: string,
  target = 4.5,
): { color: string; alpha: number } | null {
  if (contrastRatio(bg, textColor) >= target) return null;
  // binary search 0..1 sobre alpha
  let lo = 0, hi = 1, answer: number | null = null;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const blended = blendOver(overlayColor, mid, bg);
    if (contrastRatio(blended, textColor) >= target) {
      answer = mid;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return answer === null ? null : { color: overlayColor, alpha: answer };
}

/** Mezcla source con alpha sobre backdrop (opaco). Devuelve hex. */
function blendOver(source: string, alpha: number, backdrop: string): string {
  const s = parseHex(source);
  const b = parseHex(backdrop);
  const r = Math.round(s.r * alpha + b.r * (1 - alpha));
  const g = Math.round(s.g * alpha + b.g * (1 - alpha));
  const bch = Math.round(s.b * alpha + b.b * (1 - alpha));
  return '#' + [r, g, bch].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3.0;
export const WCAG_AAA_NORMAL = 7.0;
