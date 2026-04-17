import type { TemplateMeta, PositionedBlock } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, textBlock } from '../init-helpers';

export const pictureSplitting: TemplateMeta = {
  id: 'picture-splitting',
  family: 'editorial',
  label: 'Picture splitting / 图片拆分',
  initBlocks: (type, format, theme, seed, assets) => {
    const { width: W, height: H } = format;
    const decorSrc = assets?.decorASrc ?? null;
    // Imagen partida en 3 tiras horizontales con gap
    const stripes: PositionedBlock[] = [];
    for (let i = 0; i < 3; i++) {
      stripes.push(decorBlock({
        rect: { x: W * 0.1, y: H * (0.12 + i * 0.16), w: W * 0.8, h: H * 0.13 },
        src: decorSrc, seed: seed + i, zIndex: 1 + i,
      }));
    }
    const ph = placeholderForType(type);
    return [
      ...stripes,
      textBlock({
        text: ph.line1 ?? '',
        rect: { x: W * 0.1, y: H * 0.66, w: W * 0.8, h: H * 0.2 },
        fontSize: 56, color: theme.colors.primary, align: 'start',
        letterSpacing: -1, zIndex: 10,
      }, theme),
      logoBlock({ rect: { x: W * 0.1, y: H * 0.9, w: W * 0.35, h: H * 0.06 }, logoSrc: assets?.logoSrc }, theme),
    ];
  },
};
