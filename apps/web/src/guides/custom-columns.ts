import type { EditorGuide, GuideLine, SlideFormat, Vec2 } from '@/domain';

/**
 * N columnas (default 12) con gutter proporcional — la grilla editorial
 * que se usa en InDesign, Figma, Tailwind. Se alinea con `SlideFormat.grid`
 * si está definido.
 */
export const customColumns: EditorGuide = {
  id: 'custom-columns',
  label: 'Columnas (grid del formato)',
  description: 'Muestra las N columnas definidas en el SlideFormat con gutter.',
  renderLines: (format: SlideFormat): GuideLine[] => {
    const { width: W, height: H, grid, safeMargins: m } = format;
    const cols = grid?.columns ?? 12;
    const gutter = grid?.gutter ?? 16;
    const contentW = W - m.left - m.right;
    const colW = (contentW - gutter * (cols - 1)) / cols;
    const lines: GuideLine[] = [];
    for (let c = 0; c < cols; c++) {
      const x = m.left + c * (colW + gutter);
      lines.push({ kind: 'rect', x, y: m.top, w: colW, h: H - m.top - m.bottom, opacity: 0.15 });
    }
    return lines;
  },
  snapPoints: (format: SlideFormat): Vec2[] => {
    const { width: W, height: H, grid, safeMargins: m } = format;
    const cols = grid?.columns ?? 12;
    const gutter = grid?.gutter ?? 16;
    const contentW = W - m.left - m.right;
    const colW = (contentW - gutter * (cols - 1)) / cols;
    const out: Vec2[] = [];
    for (let c = 0; c <= cols; c++) {
      const x = c < cols ? m.left + c * (colW + gutter) : W - m.right;
      out.push({ x, y: m.top });
      out.push({ x, y: H - m.bottom });
      out.push({ x, y: H / 2 });
    }
    return out;
  },
};
