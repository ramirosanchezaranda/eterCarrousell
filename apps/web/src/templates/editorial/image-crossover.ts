import type { TemplateMeta } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, textBlock, shapeBlock } from '../init-helpers';

export const imageCrossover: TemplateMeta = {
  id: 'image-crossover',
  family: 'editorial',
  label: 'Image crossover / 图片跨版',
  initBlocks: (type, format, theme, seed, assets) => {
    const { width: W, height: H } = format;
    return [
      // Fondo sólido en mitad superior
      shapeBlock({ rect: { x: 0, y: 0, w: W, h: H * 0.5 }, shape: 'rect', fill: theme.colors.primary, zIndex: 1 }),
      // Imagen que cruza la línea media
      decorBlock({
        rect: { x: W * 0.15, y: H * 0.3, w: W * 0.7, h: H * 0.45 },
        src: assets?.decorASrc ?? null, seed, zIndex: 2,
      }),
      textBlock({
        text: placeholderForType(type).line1 ?? '',
        rect: { x: W * 0.1, y: H * 0.78, w: W * 0.8, h: H * 0.15 },
        fontSize: 56, color: theme.colors.primary, align: 'middle',
        letterSpacing: -1, zIndex: 10,
      }, theme),
      logoBlock({ rect: { x: W * 0.08, y: H * 0.06, w: W * 0.3, h: H * 0.05 }, color: theme.colors.bg, logoSrc: assets?.logoSrc }, theme),
    ];
  },
};
