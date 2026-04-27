/**
 * Smart guides estilo Canva. Módulo puro (sin React, sin DOM, sin store).
 *
 * Dado un rect arrastrado y la lista de "targets" (otros bloques + bordes
 * del canvas + safe margins), calcula:
 *
 *   1. Alineaciones de borde/centro entre el rect y los targets.
 *      - Vertical:   left | centerX | right del rect    ↔   left | centerX | right del target
 *      - Horizontal: top  | centerY | bottom del rect   ↔   top  | centerY | bottom del target
 *      Cuando hay match dentro del threshold, devuelve la línea de guía
 *      (que se extiende cubriendo el bbox de ambos rects + un margen) y
 *      un delta de snap para pegar el rect.
 *
 *   2. Distancias en píxeles a los 4 vecinos más cercanos (izq/der/arriba/abajo).
 *      Lo que el usuario pidió: "diferencia de píxeles".
 *
 *   3. Gaps iguales entre 3 rects en el mismo eje (`= =` markers). Cuando
 *      el rect arrastrado deja un gap idéntico al gap entre otros dos
 *      bloques, marca ambos. Soporta snap a la posición exact-equal.
 *
 *   4. Rotated blocks: se usan vía AABB (bounding box axis-aligned) tanto
 *      como source como target — Canva hace lo mismo, evita guías raras
 *      en bloques con rotación arbitraria.
 *
 * Las coordenadas son del slide (no de pantalla). El consumer multiplica
 * por `scale` solo al renderizar para que las labels y stroke widths se
 * vean al mismo tamaño visual independientemente del zoom.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SmartGuideKind = 'vertical' | 'horizontal';
export type EdgeRole = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

export interface SmartGuide {
  kind: SmartGuideKind;
  /** Coordenada de la línea (x si vertical, y si horizontal). */
  position: number;
  /** Extensión perpendicular a la línea (y-range si vertical, x-range si horizontal). */
  extentStart: number;
  extentEnd: number;
  draggedRole: EdgeRole;
  targetRole: EdgeRole;
  /** Útil para debug/desambiguar (ej. "block-vs-block", "block-vs-canvas"). */
  source: 'block' | 'canvas' | 'safeMargin' | 'equalGap';
}

export interface DistanceLabel {
  /** Posición central del label en coords del slide. */
  x: number;
  y: number;
  /** Píxeles redondeados al entero más cercano (lo que ve el usuario). */
  pixels: number;
  /** Endpoints de la línea de medición (para los tick marks). */
  from: { x: number; y: number };
  to: { x: number; y: number };
  axis: 'x' | 'y';
}

export interface EqualGapMarker {
  axis: 'x' | 'y';
  /** Cada gap es un segmento perpendicular al eje del gap. */
  gaps: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  pixels: number;
}

export interface SmartGuidesInput {
  /** Rect actualmente arrastrado (ya con el delta de movimiento aplicado). */
  dragRect: Rect;
  /** Rotación del rect arrastrado en grados (0 si no rota). */
  dragRotation?: number;
  /** Otros bloques / canvas / margins. Cada target ya viene como AABB. */
  targets: ReadonlyArray<TargetRect>;
  /** Threshold de snap en unidades del slide. */
  threshold: number;
  /** Si true, calcula equal-gap markers (más caro). Default true. */
  computeEqualGaps?: boolean;
  /** Si false, solo emite guías sin aplicar snap (útil para resize en algún handle). */
  applySnap?: boolean;
  /** Edges del rect arrastrado que pueden moverse. Default: todos. Para
   *  resize de un handle, restringe a los edges afectados (ej: 'right' para 'e'). */
  movableEdges?: ReadonlyArray<EdgeRole>;
}

export interface TargetRect {
  rect: Rect;
  source: 'block' | 'canvas' | 'safeMargin';
  /** Identificador del bloque (si aplica) — útil para debug y para excluir
   *  el bloque arrastrado de los targets. */
  id?: string;
}

export interface SmartGuidesResult {
  /** Líneas de guía a renderizar. */
  guides: SmartGuide[];
  /** Distancias a vecinos más cercanos (izq/der/arriba/abajo). */
  distances: DistanceLabel[];
  /** Markers de gaps iguales. */
  equalGaps: EqualGapMarker[];
  /** Delta a sumarle al rect para snapear. {dx: 0, dy: 0} si no hay snap. */
  snap: { dx: number; dy: number };
}

// =============================================================================
// AABB de rect rotado
// =============================================================================

/**
 * Bounding box axis-aligned de un rect rotado alrededor de su centro.
 * Si rotation es 0/null, devuelve el rect original.
 */
export function rotatedAabb(rect: Rect, rotation: number | undefined): Rect {
  if (!rotation || rotation % 360 === 0) return rect;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = rect.w * cos + rect.h * sin;
  const h = rect.w * sin + rect.h * cos;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

// =============================================================================
// Edges/centros de un rect
// =============================================================================

interface RectLines {
  vertical: Array<{ role: EdgeRole; x: number }>;
  horizontal: Array<{ role: EdgeRole; y: number }>;
}

function rectLines(r: Rect): RectLines {
  return {
    vertical: [
      { role: 'left', x: r.x },
      { role: 'centerX', x: r.x + r.w / 2 },
      { role: 'right', x: r.x + r.w },
    ],
    horizontal: [
      { role: 'top', y: r.y },
      { role: 'centerY', y: r.y + r.h / 2 },
      { role: 'bottom', y: r.y + r.h },
    ],
  };
}

const ALL_EDGES: ReadonlyArray<EdgeRole> = ['left', 'centerX', 'right', 'top', 'centerY', 'bottom'];

// =============================================================================
// Cómputo principal
// =============================================================================

export function computeSmartGuides(input: SmartGuidesInput): SmartGuidesResult {
  const {
    dragRect,
    dragRotation = 0,
    targets,
    threshold,
    computeEqualGaps = true,
    applySnap = true,
    movableEdges = ALL_EDGES,
  } = input;

  const dragAabb = rotatedAabb(dragRect, dragRotation);
  const dragLines = rectLines(dragAabb);
  const movableSet = new Set(movableEdges);

  // -----------------------------------------------------------------
  // 1. Buscar mejor snap por eje (solo en edges arrastrables).
  // -----------------------------------------------------------------
  let bestX: { delta: number; absDist: number } | null = null;
  let bestY: { delta: number; absDist: number } | null = null;

  for (const t of targets) {
    const tLines = rectLines(t.rect);
    for (const dl of dragLines.vertical) {
      if (!movableSet.has(dl.role)) continue;
      for (const tl of tLines.vertical) {
        const delta = tl.x - dl.x;
        const abs = Math.abs(delta);
        if (abs <= threshold && (bestX === null || abs < bestX.absDist)) {
          bestX = { delta, absDist: abs };
        }
      }
    }
    for (const dl of dragLines.horizontal) {
      if (!movableSet.has(dl.role)) continue;
      for (const tl of tLines.horizontal) {
        const delta = tl.y - dl.y;
        const abs = Math.abs(delta);
        if (abs <= threshold && (bestY === null || abs < bestY.absDist)) {
          bestY = { delta, absDist: abs };
        }
      }
    }
  }

  const snap = applySnap
    ? { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0 }
    : { dx: 0, dy: 0 };

  // Aplicamos el snap a una copia del AABB para emitir guías sobre la
  // posición FINAL (post-snap). Si no hay snap, queda igual.
  const snappedAabb: Rect = {
    x: dragAabb.x + snap.dx,
    y: dragAabb.y + snap.dy,
    w: dragAabb.w,
    h: dragAabb.h,
  };
  const snappedLines = rectLines(snappedAabb);

  // -----------------------------------------------------------------
  // 2. Emitir guías para TODAS las alineaciones exactas (post-snap).
  //    Una guía por (rol arrastrado, target, rol target). Se de-dupplica
  //    abajo agrupando por (kind, position).
  // -----------------------------------------------------------------
  const rawGuides: SmartGuide[] = [];

  // Tolerance para considerar "alineado exacto" después de snap. Usamos
  // medio threshold porque muy chico (<0.5) podría fallar por errores de
  // float, y demasiado grande mostraría guías cuando no hay match real.
  const exactTolerance = Math.max(0.5, threshold * 0.5);

  for (const t of targets) {
    const tLines = rectLines(t.rect);
    for (const dl of snappedLines.vertical) {
      for (const tl of tLines.vertical) {
        if (Math.abs(dl.x - tl.x) > exactTolerance) continue;
        rawGuides.push({
          kind: 'vertical',
          position: tl.x,
          extentStart: Math.min(snappedAabb.y, t.rect.y),
          extentEnd: Math.max(snappedAabb.y + snappedAabb.h, t.rect.y + t.rect.h),
          draggedRole: dl.role,
          targetRole: tl.role,
          source: t.source,
        });
      }
    }
    for (const dl of snappedLines.horizontal) {
      for (const tl of tLines.horizontal) {
        if (Math.abs(dl.y - tl.y) > exactTolerance) continue;
        rawGuides.push({
          kind: 'horizontal',
          position: tl.y,
          extentStart: Math.min(snappedAabb.x, t.rect.x),
          extentEnd: Math.max(snappedAabb.x + snappedAabb.w, t.rect.x + t.rect.w),
          draggedRole: dl.role,
          targetRole: tl.role,
          source: t.source,
        });
      }
    }
  }

  // De-duplicación: muchas veces dos targets disparan guías en la misma
  // línea (ej. canvas-center + safeMargin). Mergeamos extents y nos
  // quedamos con una sola guía por (kind, position) — que cubra el rango
  // total de todos los matches.
  const guides = dedupeGuides(rawGuides);

  // -----------------------------------------------------------------
  // 3. Distancias a los 4 vecinos más cercanos.
  // -----------------------------------------------------------------
  const distances = computeDistances(snappedAabb, targets);

  // -----------------------------------------------------------------
  // 4. Gaps iguales (= =).
  // -----------------------------------------------------------------
  const equalGaps = computeEqualGaps
    ? computeEqualGapMarkers(snappedAabb, targets, threshold)
    : [];

  return { guides, distances, equalGaps, snap };
}

function dedupeGuides(input: SmartGuide[]): SmartGuide[] {
  const groups = new Map<string, SmartGuide>();
  for (const g of input) {
    const key = `${g.kind}:${Math.round(g.position * 100)}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...g });
    } else {
      existing.extentStart = Math.min(existing.extentStart, g.extentStart);
      existing.extentEnd = Math.max(existing.extentEnd, g.extentEnd);
      // Preferimos source 'block' sobre 'canvas'/'safeMargin' (más informativo).
      if (g.source === 'block' && existing.source !== 'block') existing.source = 'block';
    }
  }
  return Array.from(groups.values());
}

// =============================================================================
// Distancias a vecinos más cercanos
// =============================================================================

function computeDistances(dragAabb: Rect, targets: ReadonlyArray<TargetRect>): DistanceLabel[] {
  // Para cada lado (left/right/top/bottom), buscamos el target que más
  // cerca está en ese lado y que se OVERLAPEA en el eje perpendicular
  // (si no overlapan, la distancia visual no tiene sentido — Canva
  // tampoco la muestra).
  const labels: DistanceLabel[] = [];

  const dragLeft = dragAabb.x;
  const dragRight = dragAabb.x + dragAabb.w;
  const dragTop = dragAabb.y;
  const dragBottom = dragAabb.y + dragAabb.h;

  // Helpers de overlap
  const overlapY = (t: Rect): boolean =>
    t.y < dragBottom && t.y + t.h > dragTop;
  const overlapX = (t: Rect): boolean =>
    t.x < dragRight && t.x + t.w > dragLeft;

  // Izquierda: target.right < dragLeft
  let leftBest: { gap: number; t: Rect } | null = null;
  let rightBest: { gap: number; t: Rect } | null = null;
  let topBest: { gap: number; t: Rect } | null = null;
  let bottomBest: { gap: number; t: Rect } | null = null;

  for (const t of targets) {
    const tr = t.rect;
    // Skip canvas: las distancias al canvas son distancias al borde,
    // las cubrimos en otra rama (sin overlap requirement) abajo.
    if (t.source !== 'block') continue;
    const tRight = tr.x + tr.w;
    const tBottom = tr.y + tr.h;
    if (tRight <= dragLeft && overlapY(tr)) {
      const gap = dragLeft - tRight;
      if (leftBest === null || gap < leftBest.gap) leftBest = { gap, t: tr };
    }
    if (tr.x >= dragRight && overlapY(tr)) {
      const gap = tr.x - dragRight;
      if (rightBest === null || gap < rightBest.gap) rightBest = { gap, t: tr };
    }
    if (tBottom <= dragTop && overlapX(tr)) {
      const gap = dragTop - tBottom;
      if (topBest === null || gap < topBest.gap) topBest = { gap, t: tr };
    }
    if (tr.y >= dragBottom && overlapX(tr)) {
      const gap = tr.y - dragBottom;
      if (bottomBest === null || gap < bottomBest.gap) bottomBest = { gap, t: tr };
    }
  }

  // Si no hay vecino bloque en alguna dirección, fallback al borde del canvas.
  const canvas = targets.find((t) => t.source === 'canvas');
  if (canvas) {
    const c = canvas.rect;
    if (!leftBest) {
      const gap = dragLeft - c.x;
      if (gap > 0) leftBest = { gap, t: { x: c.x, y: dragTop, w: 0, h: dragAabb.h } };
    }
    if (!rightBest) {
      const gap = c.x + c.w - dragRight;
      if (gap > 0) rightBest = { gap, t: { x: c.x + c.w, y: dragTop, w: 0, h: dragAabb.h } };
    }
    if (!topBest) {
      const gap = dragTop - c.y;
      if (gap > 0) topBest = { gap, t: { x: dragLeft, y: c.y, w: dragAabb.w, h: 0 } };
    }
    if (!bottomBest) {
      const gap = c.y + c.h - dragBottom;
      if (gap > 0) bottomBest = { gap, t: { x: dragLeft, y: c.y + c.h, w: dragAabb.w, h: 0 } };
    }
  }

  if (leftBest) {
    const tRight = leftBest.t.x + leftBest.t.w;
    // y central donde overlapan
    const yMid = midOverlap(dragTop, dragBottom, leftBest.t.y, leftBest.t.y + leftBest.t.h);
    labels.push({
      axis: 'x',
      pixels: Math.round(leftBest.gap),
      from: { x: tRight, y: yMid },
      to: { x: dragLeft, y: yMid },
      x: (tRight + dragLeft) / 2,
      y: yMid,
    });
  }
  if (rightBest) {
    const yMid = midOverlap(dragTop, dragBottom, rightBest.t.y, rightBest.t.y + rightBest.t.h);
    labels.push({
      axis: 'x',
      pixels: Math.round(rightBest.gap),
      from: { x: dragRight, y: yMid },
      to: { x: rightBest.t.x, y: yMid },
      x: (dragRight + rightBest.t.x) / 2,
      y: yMid,
    });
  }
  if (topBest) {
    const tBottom = topBest.t.y + topBest.t.h;
    const xMid = midOverlap(dragLeft, dragRight, topBest.t.x, topBest.t.x + topBest.t.w);
    labels.push({
      axis: 'y',
      pixels: Math.round(topBest.gap),
      from: { x: xMid, y: tBottom },
      to: { x: xMid, y: dragTop },
      x: xMid,
      y: (tBottom + dragTop) / 2,
    });
  }
  if (bottomBest) {
    const xMid = midOverlap(dragLeft, dragRight, bottomBest.t.x, bottomBest.t.x + bottomBest.t.w);
    labels.push({
      axis: 'y',
      pixels: Math.round(bottomBest.gap),
      from: { x: xMid, y: dragBottom },
      to: { x: xMid, y: bottomBest.t.y },
      x: xMid,
      y: (dragBottom + bottomBest.t.y) / 2,
    });
  }

  return labels;
}

function midOverlap(a1: number, a2: number, b1: number, b2: number): number {
  const lo = Math.max(a1, b1);
  const hi = Math.min(a2, b2);
  if (hi > lo) return (lo + hi) / 2;
  // Sin overlap real → el punto medio entre los dos rangos.
  return ((a1 + a2) / 2 + (b1 + b2) / 2) / 2;
}

// =============================================================================
// Equal-gap detection
// =============================================================================

/**
 * Para el eje X: buscamos pares (t1, t2) de targets bloque tal que t1 esté
 * a la izquierda del rect arrastrado y t2 a la derecha, y los gaps
 * (drag.left - t1.right) y (t2.left - drag.right) sean iguales (dentro
 * del threshold). Mismo para eje Y.
 *
 * Esto cubre el caso central de Canva ("X1 [== drag ==] X2"). Hay variantes
 * más sofisticadas (drag a la izquierda de un par, etc.) que dejamos para
 * follow-up — esta cubre el 80% del uso.
 */
function computeEqualGapMarkers(
  drag: Rect,
  targets: ReadonlyArray<TargetRect>,
  threshold: number,
): EqualGapMarker[] {
  const result: EqualGapMarker[] = [];

  const blocks = targets.filter((t) => t.source === 'block').map((t) => t.rect);
  const dragLeft = drag.x, dragRight = drag.x + drag.w;
  const dragTop = drag.y, dragBottom = drag.y + drag.h;

  // Eje X
  for (const t1 of blocks) {
    const t1Right = t1.x + t1.w;
    if (t1Right > dragLeft) continue;
    if (!verticalOverlap(t1, drag)) continue;
    const gap1 = dragLeft - t1Right;
    if (gap1 <= 0) continue;
    for (const t2 of blocks) {
      if (t2 === t1) continue;
      if (t2.x < dragRight) continue;
      if (!verticalOverlap(t2, drag)) continue;
      const gap2 = t2.x - dragRight;
      if (gap2 <= 0) continue;
      if (Math.abs(gap1 - gap2) > threshold) continue;
      const yA = midOverlap(dragTop, dragBottom, t1.y, t1.y + t1.h);
      const yB = midOverlap(dragTop, dragBottom, t2.y, t2.y + t2.h);
      result.push({
        axis: 'x',
        pixels: Math.round((gap1 + gap2) / 2),
        gaps: [
          { from: { x: t1Right, y: yA }, to: { x: dragLeft, y: yA } },
          { from: { x: dragRight, y: yB }, to: { x: t2.x, y: yB } },
        ],
      });
    }
  }

  // Eje Y
  for (const t1 of blocks) {
    const t1Bottom = t1.y + t1.h;
    if (t1Bottom > dragTop) continue;
    if (!horizontalOverlap(t1, drag)) continue;
    const gap1 = dragTop - t1Bottom;
    if (gap1 <= 0) continue;
    for (const t2 of blocks) {
      if (t2 === t1) continue;
      if (t2.y < dragBottom) continue;
      if (!horizontalOverlap(t2, drag)) continue;
      const gap2 = t2.y - dragBottom;
      if (gap2 <= 0) continue;
      if (Math.abs(gap1 - gap2) > threshold) continue;
      const xA = midOverlap(dragLeft, dragRight, t1.x, t1.x + t1.w);
      const xB = midOverlap(dragLeft, dragRight, t2.x, t2.x + t2.w);
      result.push({
        axis: 'y',
        pixels: Math.round((gap1 + gap2) / 2),
        gaps: [
          { from: { x: xA, y: t1Bottom }, to: { x: xA, y: dragTop } },
          { from: { x: xB, y: dragBottom }, to: { x: xB, y: t2.y } },
        ],
      });
    }
  }

  return result;
}

function verticalOverlap(a: Rect, b: Rect): boolean {
  return a.y < b.y + b.h && a.y + a.h > b.y;
}
function horizontalOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

// =============================================================================
// Helper: build targets array desde lista de bloques + format
// =============================================================================

export interface BlockLike {
  id: string;
  rect: Rect;
  rotation?: number;
  locked?: boolean;
}

export interface FormatLike {
  width: number;
  height: number;
  safeMargins?: { top: number; right: number; bottom: number; left: number };
}

/**
 * Helper para construir el array de targets desde la slide actual.
 * - Excluye los bloques arrastrados (matchea por id).
 * - Aplica AABB a bloques con rotación.
 * - Agrega el rect del canvas y el rect del safe margin como targets.
 */
export function buildTargets(
  blocks: ReadonlyArray<BlockLike>,
  excludeIds: ReadonlyArray<string>,
  format: FormatLike,
): TargetRect[] {
  const exclude = new Set(excludeIds);
  const targets: TargetRect[] = [];
  for (const b of blocks) {
    if (exclude.has(b.id)) continue;
    targets.push({
      rect: rotatedAabb(b.rect, b.rotation),
      source: 'block',
      id: b.id,
    });
  }
  targets.push({
    rect: { x: 0, y: 0, w: format.width, h: format.height },
    source: 'canvas',
  });
  if (format.safeMargins) {
    const m = format.safeMargins;
    targets.push({
      rect: {
        x: m.left,
        y: m.top,
        w: format.width - m.left - m.right,
        h: format.height - m.top - m.bottom,
      },
      source: 'safeMargin',
    });
  }
  return targets;
}

// =============================================================================
// Helpers para resize: edges arrastrables según el handle
// =============================================================================

export function movableEdgesForHandle(handle: string): EdgeRole[] {
  const edges: EdgeRole[] = [];
  if (handle.includes('w')) edges.push('left');
  if (handle.includes('e')) edges.push('right');
  if (handle.includes('n')) edges.push('top');
  if (handle.includes('s')) edges.push('bottom');
  // Cualquier resize también afecta los centros (corren con los edges).
  if (edges.some((e) => e === 'left' || e === 'right')) edges.push('centerX');
  if (edges.some((e) => e === 'top' || e === 'bottom')) edges.push('centerY');
  return edges;
}
