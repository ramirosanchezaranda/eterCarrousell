import type { EditorGuide, GuideLine, SlideFormat, Vec2 } from '@/domain';

/** Diagonal de esquina a esquina con perpendiculares auxiliares. */
export const diagonalA: EditorGuide = {
  id: 'diagonal-a',
  label: 'Diagonal ↘',
  description: 'Diagonal superior-izquierda a inferior-derecha con perpendiculares desde esquinas.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H } = format;
    const midX = W / 2, midY = H / 2;
    return [
      { kind: 'line', x1: 0, y1: 0, x2: W, y2: H, opacity: 0.5 },
      { kind: 'line', x1: 0, y1: H, x2: midX, y2: midY, opacity: 0.3 },
      { kind: 'line', x1: W, y1: 0, x2: midX, y2: midY, opacity: 0.3 },
    ];
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H } = format;
    return [
      { x: 0, y: 0 }, { x: W, y: H }, { x: W / 2, y: H / 2 },
      { x: W / 4, y: H / 4 }, { x: (3 * W) / 4, y: (3 * H) / 4 },
    ];
  },
};

/** Diagonal inversa ↙ (la imagen de espejo de la anterior). */
export const diagonalB: EditorGuide = {
  id: 'diagonal-b',
  label: 'Diagonal ↙',
  description: 'Diagonal superior-derecha a inferior-izquierda. Útil para composiciones dinámicas.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H } = format;
    const midX = W / 2, midY = H / 2;
    return [
      { kind: 'line', x1: W, y1: 0, x2: 0, y2: H, opacity: 0.5 },
      { kind: 'line', x1: 0, y1: 0, x2: midX, y2: midY, opacity: 0.3 },
      { kind: 'line', x1: W, y1: H, x2: midX, y2: midY, opacity: 0.3 },
    ];
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H } = format;
    return [
      { x: 0, y: H }, { x: W, y: 0 }, { x: W / 2, y: H / 2 },
      { x: W / 4, y: (3 * H) / 4 }, { x: (3 * W) / 4, y: H / 4 },
    ];
  },
};
