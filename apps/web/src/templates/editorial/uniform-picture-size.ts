import type { TemplateMeta, PositionedBlock } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, textBlock } from '../init-helpers';

export const uniformPictureSize: TemplateMeta = {
  id: 'uniform-picture-size',
  family: 'editorial',
  label: 'Uniform size / 大小统一',
  initBlocks: (type, format, theme, seed, assets) => {
    const { width: W, height: H } = format;
    const cols = 4, rows = 3;
    const gridW = W * 0.8, gridH = H * 0.45;
    const cellW = gridW / cols, cellH = gridH / rows;
    const startX = (W - gridW) / 2, startY = H * 0.1;
    const cells: PositionedBlock[] = [];
    const decorSrc = assets?.decorASrc ?? null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pad = Math.min(cellW, cellH) * 0.1;
        cells.push(decorBlock({
          rect: { x: startX + c * cellW + pad, y: startY + r * cellH + pad, w: cellW - 2 * pad, h: cellH - 2 * pad },
          src: decorSrc, seed: seed + r * cols + c, zIndex: 1,
        }));
      }
    }
    return [
      ...cells,
      textBlock({
        text: placeholderForType(type).line1 ?? '',
        rect: { x: W * 0.1, y: H * 0.68, w: W * 0.8, h: H * 0.18 },
        fontSize: 56, color: theme.colors.primary, align: 'middle', letterSpacing: -1, zIndex: 10,
      }, theme),
      logoBlock({ rect: { x: W * 0.3, y: H * 0.91, w: W * 0.4, h: H * 0.05 }, logoSrc: assets?.logoSrc }, theme),
    ];
  },
};
