/**
 * Operaciones de bounding box — puras, sin DOM ni React.
 * Base para detectar colisiones, clamp a safe area, y reflow.
 */
import type { Rect, SlideFormat } from '@/domain';

export function rectIntersects(a: Rect, b: Rect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function rectArea(r: Rect): number {
  return Math.max(0, r.w) * Math.max(0, r.h);
}

export function intersectionArea(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

/** Rect de la zona segura del formato (sin márgenes). */
export function safeAreaRect(format: SlideFormat): Rect {
  const { top, right, bottom, left } = format.safeMargins;
  return { x: left, y: top, w: format.width - left - right, h: format.height - top - bottom };
}

/**
 * Clampea un rect para que quede dentro del safe area. Si el rect es más
 * grande que el safe area, lo encoge; si está corrido, lo empuja.
 */
export function clampToSafe(rect: Rect, format: SlideFormat): Rect {
  const safe = safeAreaRect(format);
  const w = Math.min(rect.w, safe.w);
  const h = Math.min(rect.h, safe.h);
  const x = Math.max(safe.x, Math.min(rect.x, safe.x + safe.w - w));
  const y = Math.max(safe.y, Math.min(rect.y, safe.y + safe.h - h));
  return { x, y, w, h };
}

export interface RectWithId { id: string; rect: Rect; zIndex: number; kind?: string }

export interface Collision { a: string; b: string; area: number }

/** Detecta todas las colisiones entre rects. Ignora rects con `kind === 'decor'` entre sí. */
export function detectCollisions(items: RectWithId[], ignoreKinds: string[] = ['decor']): Collision[] {
  const out: Collision[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (ignoreKinds.includes(a.kind ?? '') && ignoreKinds.includes(b.kind ?? '')) continue;
      const area = intersectionArea(a.rect, b.rect);
      if (area > 0) out.push({ a: a.id, b: b.id, area });
    }
  }
  return out;
}

/** Empuja rect fuera de otro rect por el eje de menor desplazamiento necesario. */
export function pushOutside(mover: Rect, blocker: Rect, format: SlideFormat): Rect {
  const dxLeft = blocker.x - (mover.x + mover.w);
  const dxRight = blocker.x + blocker.w - mover.x;
  const dyTop = blocker.y - (mover.y + mover.h);
  const dyBottom = blocker.y + blocker.h - mover.y;
  const opts = [
    { dx: dxLeft, dy: 0, abs: Math.abs(dxLeft) },
    { dx: dxRight, dy: 0, abs: Math.abs(dxRight) },
    { dx: 0, dy: dyTop, abs: Math.abs(dyTop) },
    { dx: 0, dy: dyBottom, abs: Math.abs(dyBottom) },
  ].sort((a, b) => a.abs - b.abs);
  const best = opts[0]!;
  return clampToSafe({ x: mover.x + best.dx, y: mover.y + best.dy, w: mover.w, h: mover.h }, format);
}
