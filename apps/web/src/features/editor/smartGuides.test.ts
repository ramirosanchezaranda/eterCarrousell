/**
 * Tests del módulo de smart guides. Cubren:
 *   - AABB de rect rotado
 *   - Detección de alineación borde/centro contra otros bloques
 *   - Snap a la posición exacta cuando entra en threshold
 *   - Distancias a vecinos (4 direcciones)
 *   - Equal-gap detection (= =)
 *   - Edges arrastrables limitados (resize por handle)
 *   - Helper buildTargets
 */
import { describe, expect, it } from 'vitest';
import {
  buildTargets,
  computeSmartGuides,
  movableEdgesForHandle,
  rotatedAabb,
  type Rect,
  type TargetRect,
} from './smartGuides';

const FORMAT = { width: 1080, height: 1080, safeMargins: { top: 40, right: 40, bottom: 40, left: 40 } };

const target = (rect: Rect, source: TargetRect['source'] = 'block', id?: string): TargetRect => ({ rect, source, id });

describe('rotatedAabb', () => {
  it('rotación 0 devuelve el rect original', () => {
    expect(rotatedAabb({ x: 10, y: 20, w: 100, h: 50 }, 0)).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });
  it('rotación 90 transpone w/h', () => {
    const r = rotatedAabb({ x: 0, y: 0, w: 100, h: 50 }, 90);
    expect(r.w).toBeCloseTo(50, 5);
    expect(r.h).toBeCloseTo(100, 5);
    // Centro preservado
    expect(r.x + r.w / 2).toBeCloseTo(50, 5);
    expect(r.y + r.h / 2).toBeCloseTo(25, 5);
  });
  it('rotación 45 ensancha w y h por sqrt(2)', () => {
    const r = rotatedAabb({ x: 0, y: 0, w: 100, h: 100 }, 45);
    const expected = 100 * Math.SQRT2;
    expect(r.w).toBeCloseTo(expected, 3);
    expect(r.h).toBeCloseTo(expected, 3);
  });
});

describe('computeSmartGuides — alineación', () => {
  it('detecta alineación left-edge con otro bloque y snapea', () => {
    const drag: Rect = { x: 102, y: 200, w: 100, h: 50 };
    const targets = [target({ x: 100, y: 50, w: 80, h: 80 })];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 8 });
    expect(r.snap.dx).toBe(-2); // 102 → 100
    expect(r.guides.some((g) => g.kind === 'vertical' && Math.round(g.position) === 100)).toBe(true);
  });

  it('detecta alineación de centro-X con otro bloque', () => {
    // dragged center-X = 60, target center-X = 64 → delta 4, snapea
    const drag: Rect = { x: 10, y: 200, w: 100, h: 50 };
    const targets = [target({ x: 14, y: 50, w: 100, h: 80 })];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 8 });
    expect(r.snap.dx).toBe(4);
  });

  it('detecta alineación top-edge', () => {
    const drag: Rect = { x: 100, y: 53, w: 50, h: 50 };
    const targets = [target({ x: 200, y: 50, w: 50, h: 50 })];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 8 });
    expect(r.snap.dy).toBe(-3);
    expect(r.guides.some((g) => g.kind === 'horizontal' && Math.round(g.position) === 50)).toBe(true);
  });

  it('no snapea cuando supera threshold', () => {
    const drag: Rect = { x: 200, y: 200, w: 50, h: 50 };
    const targets = [target({ x: 100, y: 100, w: 50, h: 50 })];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 8 });
    expect(r.snap.dx).toBe(0);
    expect(r.snap.dy).toBe(0);
    expect(r.guides).toHaveLength(0);
  });

  it('elige el snap MÁS CERCANO cuando hay varios candidatos', () => {
    const drag: Rect = { x: 105, y: 200, w: 50, h: 50 }; // left=105
    const targets = [
      target({ x: 99, y: 0, w: 50, h: 50 }),  // left=99 → delta -6
      target({ x: 102, y: 0, w: 50, h: 50 }), // left=102 → delta -3 ← gana
    ];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 8 });
    expect(r.snap.dx).toBe(-3);
  });

  it('alinea contra el canvas (centro)', () => {
    // Canvas centro X = 540. dragged center-X = 535 → delta 5
    const drag: Rect = { x: 485, y: 200, w: 100, h: 50 };
    const targets = [target({ x: 0, y: 0, w: 1080, h: 1080 }, 'canvas')];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 8 });
    expect(r.snap.dx).toBe(5);
  });
});

describe('computeSmartGuides — distancias', () => {
  it('mide distancia al vecino izquierdo', () => {
    const drag: Rect = { x: 200, y: 100, w: 50, h: 100 };
    const targets = [target({ x: 50, y: 100, w: 100, h: 100 })]; // gap = 200 - 150 = 50
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4 });
    const left = r.distances.find((d) => d.axis === 'x' && d.from.x === 150);
    expect(left).toBeDefined();
    expect(left!.pixels).toBe(50);
  });

  it('mide distancia al vecino superior con overlap-X', () => {
    const drag: Rect = { x: 100, y: 300, w: 100, h: 100 };
    const targets = [target({ x: 100, y: 100, w: 100, h: 100 })]; // gap = 300 - 200 = 100
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4 });
    const top = r.distances.find((d) => d.axis === 'y');
    expect(top).toBeDefined();
    expect(top!.pixels).toBe(100);
  });

  it('NO mide distancia cuando no hay overlap perpendicular (caso bloque)', () => {
    const drag: Rect = { x: 200, y: 500, w: 50, h: 50 };
    // El target está a la izquierda pero no overlapa en Y
    const targets = [target({ x: 50, y: 100, w: 50, h: 50 })];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4 });
    expect(r.distances.find((d) => d.axis === 'x' && d.to.x === drag.x)).toBeUndefined();
  });

  it('cae al borde del canvas si no hay vecino en una dirección', () => {
    const drag: Rect = { x: 500, y: 500, w: 100, h: 100 };
    const targets = [target({ x: 0, y: 0, w: 1080, h: 1080 }, 'canvas')];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4 });
    // Distancias al borde izquierdo (500), derecho (480), arriba (500), abajo (480)
    expect(r.distances).toHaveLength(4);
    expect(r.distances.find((d) => d.axis === 'x' && d.pixels === 500)).toBeDefined();
    expect(r.distances.find((d) => d.axis === 'x' && d.pixels === 480)).toBeDefined();
    expect(r.distances.find((d) => d.axis === 'y' && d.pixels === 500)).toBeDefined();
    expect(r.distances.find((d) => d.axis === 'y' && d.pixels === 480)).toBeDefined();
  });
});

describe('computeSmartGuides — equal gaps', () => {
  it('detecta gaps iguales a izquierda y derecha (eje X)', () => {
    // T1=[0,0,100,50], drag=[150,0,100,50], T2=[300,0,100,50]
    // gap1 = 150 - 100 = 50, gap2 = 300 - 250 = 50 → equal
    const drag: Rect = { x: 150, y: 0, w: 100, h: 50 };
    const targets = [
      target({ x: 0, y: 0, w: 100, h: 50 }),
      target({ x: 300, y: 0, w: 100, h: 50 }),
    ];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4 });
    expect(r.equalGaps.length).toBeGreaterThan(0);
    const xGap = r.equalGaps.find((eg) => eg.axis === 'x');
    expect(xGap?.pixels).toBe(50);
    expect(xGap?.gaps).toHaveLength(2);
  });

  it('detecta gaps iguales arriba y abajo (eje Y)', () => {
    const drag: Rect = { x: 0, y: 150, w: 50, h: 100 };
    const targets = [
      target({ x: 0, y: 0, w: 50, h: 100 }),
      target({ x: 0, y: 300, w: 50, h: 100 }),
    ];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4 });
    const yGap = r.equalGaps.find((eg) => eg.axis === 'y');
    expect(yGap?.pixels).toBe(50);
  });

  it('NO detecta cuando los gaps difieren más que threshold', () => {
    const drag: Rect = { x: 150, y: 0, w: 100, h: 50 };
    const targets = [
      target({ x: 0, y: 0, w: 100, h: 50 }),     // gap1 = 50
      target({ x: 300, y: 0, w: 100, h: 50 }),   // gap2 = 50 → igual
      target({ x: 800, y: 0, w: 100, h: 50 }),   // gap3 = 550 → no igual a 50
    ];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4 });
    // Solo el match 50/50 cuenta, el 50/550 NO
    const equalGaps50 = r.equalGaps.filter((eg) => eg.pixels === 50);
    expect(equalGaps50.length).toBeGreaterThan(0);
    const big = r.equalGaps.filter((eg) => eg.pixels >= 200);
    expect(big.length).toBe(0);
  });

  it('puede deshabilitarse con computeEqualGaps=false', () => {
    const drag: Rect = { x: 150, y: 0, w: 100, h: 50 };
    const targets = [
      target({ x: 0, y: 0, w: 100, h: 50 }),
      target({ x: 300, y: 0, w: 100, h: 50 }),
    ];
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4, computeEqualGaps: false });
    expect(r.equalGaps).toHaveLength(0);
  });
});

describe('computeSmartGuides — applySnap=false', () => {
  it('emite guides sobre la posición actual (sin snapear)', () => {
    const drag: Rect = { x: 100, y: 100, w: 50, h: 50 };
    const targets = [target({ x: 100, y: 0, w: 50, h: 50 })]; // alineado en left
    const r = computeSmartGuides({ dragRect: drag, targets, threshold: 4, applySnap: false });
    expect(r.snap).toEqual({ dx: 0, dy: 0 });
    expect(r.guides.length).toBeGreaterThan(0);
  });
});

describe('computeSmartGuides — movableEdges (resize)', () => {
  it('respeta movableEdges: solo snap en edges arrastrables', () => {
    // Resize handle 'e' = mover right edge. El left edge no debe snapear.
    // El target tiene su LEFT alineado con el LEFT del drag (delta=2), pero
    // su right/centerX están lejos → no debería haber match porque 'left'
    // no es un edge arrastrable.
    const drag: Rect = { x: 100, y: 100, w: 50, h: 50 }; // left=100, right=150
    const targets = [target({ x: 102, y: 0, w: 300, h: 50 })]; // left=102, right=402, centerX=252
    const r = computeSmartGuides({
      dragRect: drag,
      targets,
      threshold: 4,
      movableEdges: ['right'],
    });
    expect(r.snap.dx).toBe(0); // no snapeó porque left no es movable y los demás están lejos
  });
});

describe('movableEdgesForHandle', () => {
  it('handle "e" → right + centerX', () => {
    expect(movableEdgesForHandle('e')).toEqual(expect.arrayContaining(['right', 'centerX']));
  });
  it('handle "se" → right + bottom + centerX + centerY', () => {
    expect(movableEdgesForHandle('se')).toEqual(expect.arrayContaining(['right', 'bottom', 'centerX', 'centerY']));
  });
  it('handle "n" → top + centerY', () => {
    expect(movableEdgesForHandle('n')).toEqual(expect.arrayContaining(['top', 'centerY']));
  });
});

describe('buildTargets', () => {
  it('excluye los bloques arrastrados', () => {
    const blocks = [
      { id: 'a', rect: { x: 0, y: 0, w: 50, h: 50 } },
      { id: 'b', rect: { x: 100, y: 0, w: 50, h: 50 } },
    ];
    const targets = buildTargets(blocks, ['a'], FORMAT);
    expect(targets.find((t) => t.id === 'a')).toBeUndefined();
    expect(targets.find((t) => t.id === 'b')).toBeDefined();
  });

  it('incluye canvas y safeMargin', () => {
    const targets = buildTargets([], [], FORMAT);
    expect(targets.find((t) => t.source === 'canvas')).toBeDefined();
    expect(targets.find((t) => t.source === 'safeMargin')).toBeDefined();
  });

  it('aplica AABB a bloques rotados', () => {
    const blocks = [{ id: 'a', rect: { x: 0, y: 0, w: 100, h: 50 }, rotation: 90 }];
    const targets = buildTargets(blocks, [], FORMAT);
    const aabb = targets.find((t) => t.id === 'a')!.rect;
    expect(aabb.w).toBeCloseTo(50);
    expect(aabb.h).toBeCloseTo(100);
  });
});
