import type { EditorGuide, GuideLine, SlideFormat, Vec2 } from '@/domain';
import { mesh } from './math';

export const ruleOfQuarters: EditorGuide = {
  id: 'rule-of-quarters',
  label: 'Regla de cuartos',
  description: 'Divide el canvas en 4×4. Mayor granularidad que la regla de tercios.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H } = format;
    const xs = [W * 0.25, W * 0.5, W * 0.75];
    const ys = [H * 0.25, H * 0.5, H * 0.75];
    return [
      ...xs.map<GuideLine>((x) => ({ kind: 'line', x1: x, y1: 0, x2: x, y2: H, opacity: 0.3 })),
      ...ys.map<GuideLine>((y) => ({ kind: 'line', x1: 0, y1: y, x2: W, y2: y, opacity: 0.3 })),
    ];
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H } = format;
    return mesh([0, W * 0.25, W * 0.5, W * 0.75, W], [0, H * 0.25, H * 0.5, H * 0.75, H]);
  },
};
