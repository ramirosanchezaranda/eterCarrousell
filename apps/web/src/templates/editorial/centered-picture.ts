import type { TemplateMeta } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, textBlock } from '../init-helpers';

export const centeredPicture: TemplateMeta = {
  id: 'centered-picture',
  family: 'editorial',
  label: 'Centered picture / 图居中',
  initBlocks: (type, format, theme, seed, assets) => {
    const { width: W, height: H } = format;
    const dSize = Math.min(W, H) * 0.55;
    return [
      decorBlock({
        rect: { x: (W - dSize) / 2, y: (H - dSize) / 2 - H * 0.05, w: dSize, h: dSize },
        src: assets?.decorASrc ?? null, seed, zIndex: 1,
      }),
      textBlock({
        text: placeholderForType(type).line1 ?? '',
        rect: { x: W * 0.1, y: H * 0.8, w: W * 0.8, h: H * 0.1 },
        fontSize: 48, color: theme.colors.primary, align: 'middle', letterSpacing: -0.5, zIndex: 10,
      }, theme),
      logoBlock({ rect: { x: W * 0.3, y: H * 0.93, w: W * 0.4, h: H * 0.05 }, logoSrc: assets?.logoSrc }, theme),
    ];
  },
};
