/**
 * Helpers matemáticos compartidos por los 12 guides.
 * Se expresan todos en función del `SlideFormat` para que funcionen en
 * cualquier aspect ratio (1:1, 4:5, 9:16, etc.).
 */
import type { SlideFormat, Vec2 } from '@/domain';

export const PHI = (1 + Math.sqrt(5)) / 2;           // 1.61803...
export const INV_PHI = 1 / PHI;                       // 0.61803...

export interface Box { x: number; y: number; w: number; h: number }

export function canvasBox(format: SlideFormat): Box {
  return { x: 0, y: 0, w: format.width, h: format.height };
}

export function safeBox(format: SlideFormat): Box {
  const { top, right, bottom, left } = format.safeMargins;
  return {
    x: left,
    y: top,
    w: format.width - left - right,
    h: format.height - top - bottom,
  };
}

export function cross(pts: Vec2[]): Vec2[] {
  return pts;
}

/** Interseca todos los valores X con todos los Y → malla de puntos. */
export function mesh(xs: number[], ys: number[]): Vec2[] {
  const out: Vec2[] = [];
  for (const x of xs) for (const y of ys) out.push({ x, y });
  return out;
}
