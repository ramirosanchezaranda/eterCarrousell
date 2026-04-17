/**
 * Motor validador de PositionedBlocks. Se ejecuta en `dragEnd` (y al subir
 * imágenes, cambiar formato, etc.). No modifica el input; devuelve una
 * versión corregida + lista de warnings.
 *
 * Responsabilidades:
 *   1. Respeto de safe margins (clamp a safe area).
 *   2. Detección de overlaps y empuje al vecino más cercano.
 *   3. Fitting tipográfico: si un texto no entra en su rect, reducir fontSize.
 *   4. Contraste WCAG: ajustar color del texto o inyectar overlay local.
 *
 * Todas las funciones son puras — sin React, sin Zustand.
 */
import type { PositionedBlock, SlideFormat, TextContent } from '@/domain';
import { clampToSafe, detectCollisions, pushOutside, type RectWithId } from './bboxes';
import { contrastRatio, pickReadableColor, WCAG_AA_NORMAL } from './contrast';
import { fitFontSize } from './typography';

export interface Warning {
  blockId: string;
  kind: 'out-of-safe' | 'overlap' | 'text-overflow' | 'low-contrast';
  autoFixed: boolean;
  detail?: string;
}

export interface SolveResult {
  blocks: PositionedBlock[];
  warnings: Warning[];
}

export interface SolveOptions {
  backgroundColor?: string;   // fondo efectivo detrás de los bloques (para contraste)
  contrastTarget?: number;    // default WCAG AA normal (4.5)
  autoFix?: boolean;          // si false, solo detecta y no muta
}

export function solveLayout(
  inputBlocks: PositionedBlock[],
  format: SlideFormat,
  opts: SolveOptions = {},
): SolveResult {
  const { backgroundColor = '#F1E8D3', contrastTarget = WCAG_AA_NORMAL, autoFix = true } = opts;
  const warnings: Warning[] = [];
  let blocks = inputBlocks.map((b) => ({ ...b, rect: { ...b.rect } }));

  // 1. Clamp a safe area (excepto decor y shapes que pueden sangrar intencionalmente)
  blocks = blocks.map((b) => {
    if (b.kind === 'decor' || b.kind === 'accent') return b;
    const clamped = clampToSafe(b.rect, format);
    if (clamped.x !== b.rect.x || clamped.y !== b.rect.y || clamped.w !== b.rect.w || clamped.h !== b.rect.h) {
      warnings.push({ blockId: b.id, kind: 'out-of-safe', autoFixed: autoFix });
      if (autoFix) return { ...b, rect: clamped };
    }
    return b;
  });

  // 2. Overlap — se ignora entre decor/accent que están pensados para superponerse con texto
  const rects: RectWithId[] = blocks
    .filter((b) => b.kind !== 'decor' && b.kind !== 'accent')
    .map((b) => ({ id: b.id, rect: b.rect, zIndex: b.zIndex, kind: b.kind }));
  const collisions = detectCollisions(rects, []);
  for (const col of collisions) {
    const a = blocks.find((b) => b.id === col.a);
    const b = blocks.find((x) => x.id === col.b);
    if (!a || !b) continue;
    warnings.push({ blockId: a.zIndex <= b.zIndex ? a.id : b.id, kind: 'overlap', autoFixed: autoFix, detail: `overlap ${Math.round(col.area)}px²` });
    if (autoFix) {
      const mover = a.zIndex <= b.zIndex ? a : b;
      const blocker = a.zIndex <= b.zIndex ? b : a;
      mover.rect = pushOutside(mover.rect, blocker.rect, format);
    }
  }

  // 3. Text fit + contraste
  blocks = blocks.map((b) => {
    if (b.content.kind !== 'text') return b;
    const text = b.content.text;
    if (!text) return b;
    const fit = fitFontSize(
      text,
      b.rect,
      {
        family: b.content.fontRole === 'mono' ? 'monospace' : 'serif',
        weight: b.content.fontWeight,
        style: b.content.fontStyle,
        letterSpacing: b.content.letterSpacing,
      },
      { min: 10, max: Math.max(b.content.fontSize, 10), preferred: b.content.fontSize },
      b.content.lineHeight ?? 1.15,
    );
    let nextContent: TextContent = b.content;
    if (fit.fontSize < b.content.fontSize - 0.5) {
      warnings.push({ blockId: b.id, kind: 'text-overflow', autoFixed: autoFix, detail: `${b.content.fontSize}→${Math.round(fit.fontSize)}` });
      if (autoFix) nextContent = { ...b.content, fontSize: Math.floor(fit.fontSize) };
    }
    // Contraste
    const bgSample = backgroundColor;
    const ratio = contrastRatio(bgSample, nextContent.color);
    if (ratio < contrastTarget) {
      warnings.push({ blockId: b.id, kind: 'low-contrast', autoFixed: autoFix, detail: `ratio ${ratio.toFixed(2)}` });
      if (autoFix) {
        nextContent = { ...nextContent, color: pickReadableColor(bgSample) };
      }
    }
    return { ...b, content: nextContent };
  });

  return { blocks, warnings };
}
