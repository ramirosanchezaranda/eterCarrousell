import type { EditorGuide, GuideLine, SlideFormat, Vec2 } from '@/domain';
import { mesh } from './math';

/** Eje vertical central + horizontal central. Composiciones simétricas. */
export const axialSymmetry: EditorGuide = {
  id: 'axial-symmetry',
  label: 'Simetría axial',
  description: 'Ejes central vertical y horizontal. Ideal para composiciones balanceadas.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H } = format;
    return [
      { kind: 'line', x1: W / 2, y1: 0, x2: W / 2, y2: H, opacity: 0.4 },
      { kind: 'line', x1: 0, y1: H / 2, x2: W, y2: H / 2, opacity: 0.4 },
    ];
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H } = format;
    return mesh([0, W / 2, W], [0, H / 2, H]);
  },
};

/** Cruz centrada — solo el punto medio más marcado. */
export const centerCross: EditorGuide = {
  id: 'center-cross',
  label: 'Cruz central',
  description: 'Marcador único del centro geométrico del canvas.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H } = format;
    const cx = W / 2, cy = H / 2, armW = W * 0.08, armH = H * 0.06;
    return [
      { kind: 'line', x1: cx - armW, y1: cy, x2: cx + armW, y2: cy, opacity: 0.5 },
      { kind: 'line', x1: cx, y1: cy - armH, x2: cx, y2: cy + armH, opacity: 0.5 },
    ];
  },
  snapPoints: (format: SlideFormat): Vec2[] => [{ x: format.width / 2, y: format.height / 2 }],
};

/** "X" — dos diagonales cruzadas. Composición dramática. */
export const xSplit: EditorGuide = {
  id: 'x-split',
  label: 'X-split',
  description: 'Dos diagonales cruzadas. El punto central y las esquinas son los anclajes.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H } = format;
    return [
      { kind: 'line', x1: 0, y1: 0, x2: W, y2: H, opacity: 0.4 },
      { kind: 'line', x1: W, y1: 0, x2: 0, y2: H, opacity: 0.4 },
    ];
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H } = format;
    return [
      { x: 0, y: 0 }, { x: W, y: 0 }, { x: 0, y: H }, { x: W, y: H },
      { x: W / 2, y: H / 2 },
    ];
  },
};
