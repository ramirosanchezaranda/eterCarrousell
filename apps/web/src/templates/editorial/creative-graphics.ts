import type { TemplateMeta } from '@/domain';
import { logoBlock, placeholderForType, shapeBlock, textBlock } from '../init-helpers';

export const creativeGraphics: TemplateMeta = {
  id: 'creative-graphics',
  family: 'editorial',
  label: 'Creative graphics / 创意图形',
  initBlocks: (type, format, theme, _seed, assets) => {
    const { width: W, height: H } = format;
    return [
      // Tipografía gigante detrás ("A" como fondo)
      textBlock({
        text: 'A', rect: { x: W * 0.1, y: H * 0.05, w: W * 0.8, h: H * 0.8 },
        fontSize: 600, color: theme.colors.primary + '22', align: 'middle', letterSpacing: -20, fontWeight: 900,
        zIndex: 1,
      }, theme),
      shapeBlock({ rect: { x: W * 0.1, y: H * 0.3, w: W * 0.2, h: H * 0.2 }, shape: 'circle', fill: theme.colors.primary, zIndex: 2 }),
      shapeBlock({ rect: { x: W * 0.7, y: H * 0.55, w: W * 0.15, h: H * 0.15 }, shape: 'rect', fill: theme.colors.light, zIndex: 2 }),
      textBlock({
        text: placeholderForType(type).line1 ?? '',
        rect: { x: W * 0.1, y: H * 0.72, w: W * 0.8, h: H * 0.15 },
        fontSize: 60, color: theme.colors.ink, align: 'start', letterSpacing: -1, fontWeight: 700, zIndex: 10,
      }, theme),
      logoBlock({ rect: { x: W * 0.1, y: H * 0.9, w: W * 0.3, h: H * 0.05 }, logoSrc: assets?.logoSrc }, theme),
    ];
  },
};
