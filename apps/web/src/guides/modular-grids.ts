import type { EditorGuide, GuideLine, SlideFormat, Vec2 } from '@/domain';
import { mesh } from './math';

function modularGrid(cols: number, rows: number, id: EditorGuide['id'], label: string): EditorGuide {
  return {
    id,
    label,
    description: `Retícula modular ${cols}×${rows}. Subdivide el canvas en celdas uniformes.`,
    renderLines: (format: SlideFormat): GuideLine[] => {
      const { width: W, height: H } = format;
      const lines: GuideLine[] = [];
      for (let c = 1; c < cols; c++) {
        const x = (W * c) / cols;
        lines.push({ kind: 'line', x1: x, y1: 0, x2: x, y2: H, opacity: 0.25 });
      }
      for (let r = 1; r < rows; r++) {
        const y = (H * r) / rows;
        lines.push({ kind: 'line', x1: 0, y1: y, x2: W, y2: y, opacity: 0.25 });
      }
      return lines;
    },
    snapPoints: (format: SlideFormat): Vec2[] => {
      const { width: W, height: H } = format;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let c = 0; c <= cols; c++) xs.push((W * c) / cols);
      for (let r = 0; r <= rows; r++) ys.push((H * r) / rows);
      return mesh(xs, ys);
    },
  };
}

export const modular3x4 = modularGrid(3, 4, 'modular-3x4', 'Retícula 3×4');
export const modular4x6 = modularGrid(4, 6, 'modular-4x6', 'Retícula 4×6');
