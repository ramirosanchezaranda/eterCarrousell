import type { EditorGuide, GuideLine, SlideFormat, Vec2 } from '@/domain';
import { mesh } from './math';

export const ruleOfThirds: EditorGuide = {
  id: 'rule-of-thirds',
  label: 'Regla de tercios',
  description: 'Divide el canvas en 3×3. Los 4 puntos de intersección son los focos visuales.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H } = format;
    const x1 = W / 3, x2 = (2 * W) / 3, y1 = H / 3, y2 = (2 * H) / 3;
    return [
      { kind: 'line', x1, y1: 0, x2: x1, y2: H, opacity: 0.4 },
      { kind: 'line', x1: x2, y1: 0, x2, y2: H, opacity: 0.4 },
      { kind: 'line', x1: 0, y1, x2: W, y2: y1, opacity: 0.4 },
      { kind: 'line', x1: 0, y1: y2, x2: W, y2: y2, opacity: 0.4 },
    ];
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H } = format;
    return mesh([0, W / 3, (2 * W) / 3, W], [0, H / 3, (2 * H) / 3, H]);
  },
};
