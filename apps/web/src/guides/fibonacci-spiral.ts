import type { EditorGuide, GuideLine, SlideFormat, Vec2 } from '@/domain';
import { INV_PHI } from './math';

/**
 * Espiral de Fibonacci: subdivide el rect en cuadrados decrecientes
 * proporcionales a 1/φ y traza un cuarto de círculo en cada uno.
 */
export const fibonacciSpiral: EditorGuide = {
  id: 'fibonacci-spiral',
  label: 'Espiral de Fibonacci',
  description: 'Subdivisión recursiva φ: 5 iteraciones. El centro atrae la mirada.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width, height } = format;
    const lines: GuideLine[] = [];
    let x = 0, y = 0, w = width, h = height;
    let direction = 0; // 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left
    for (let i = 0; i < 5; i++) {
      const squareSide = Math.min(w, h);
      const landscape = w >= h;
      let sx: number, sy: number, cx: number, cy: number;
      if (landscape) {
        sx = direction === 1 || direction === 2 ? x + w - squareSide : x;
        sy = y;
        if (direction === 0) { cx = sx + squareSide; cy = sy + squareSide; }
        else if (direction === 1) { cx = sx; cy = sy + squareSide; }
        else if (direction === 2) { cx = sx; cy = sy; }
        else { cx = sx + squareSide; cy = sy; }
      } else {
        sx = x;
        sy = direction === 2 || direction === 3 ? y + h - squareSide : y;
        if (direction === 0) { cx = sx + squareSide; cy = sy + squareSide; }
        else if (direction === 1) { cx = sx; cy = sy + squareSide; }
        else if (direction === 2) { cx = sx; cy = sy; }
        else { cx = sx + squareSide; cy = sy; }
      }
      lines.push({ kind: 'rect', x: sx, y: sy, w: squareSide, h: squareSide, opacity: 0.2 });
      lines.push({
        kind: 'path',
        d: `M ${cx - squareSide} ${cy} A ${squareSide} ${squareSide} 0 0 ${direction % 2 === 0 ? 1 : 0} ${cx} ${cy - squareSide}`,
        opacity: 0.6,
      });
      if (landscape) {
        if (direction === 0 || direction === 3) x += squareSide;
        w -= squareSide;
      } else {
        if (direction === 0 || direction === 1) y += squareSide;
        h -= squareSide;
      }
      direction = (direction + 1) % 4;
    }
    return lines;
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H } = format;
    const a = W * INV_PHI, b = H * INV_PHI;
    return [
      { x: a, y: b },
      { x: W - a, y: b },
      { x: a, y: H - b },
      { x: W - a, y: H - b },
      { x: W / 2, y: H / 2 },
    ];
  },
};
