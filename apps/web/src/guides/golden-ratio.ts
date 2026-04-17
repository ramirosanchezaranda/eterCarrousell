import type { EditorGuide, GuideLine, SlideFormat, Vec2 } from '@/domain';
import { INV_PHI, mesh } from './math';

/**
 * Proporción áurea: divide el canvas en dos franjas donde la menor es a
 * la mayor como la mayor es al total (ratio 1/φ ≈ 0.618). Más sutil que
 * la regla de tercios y favorita en diseño editorial clásico.
 */
export const goldenRatio: EditorGuide = {
  id: 'golden-ratio',
  label: 'Proporción áurea',
  description: 'Divide en franjas 1:φ. Los puntos de intersección son los focos visuales clásicos.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H } = format;
    const a = W * INV_PHI;
    const b = W - a;
    const c = H * INV_PHI;
    const d = H - c;
    return [
      { kind: 'line', x1: a, y1: 0, x2: a, y2: H, opacity: 0.4 },
      { kind: 'line', x1: b, y1: 0, x2: b, y2: H, opacity: 0.4 },
      { kind: 'line', x1: 0, y1: c, x2: W, y2: c, opacity: 0.4 },
      { kind: 'line', x1: 0, y1: d, x2: W, y2: d, opacity: 0.4 },
    ];
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H } = format;
    const a = W * INV_PHI, b = W - a, c = H * INV_PHI, d = H - c;
    return mesh([0, b, a, W], [0, d, c, H]);
  },
};
