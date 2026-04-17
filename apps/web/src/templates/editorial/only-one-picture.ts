import type { TemplateMeta } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, textBlock } from '../init-helpers';

export const onlyOnePicture: TemplateMeta = {
  id: 'only-one-picture',
  family: 'editorial',
  label: 'Only one picture / 只有一张图片',
  initBlocks: (type, format, theme, seed, assets) => {
    const { width: W, height: H } = format;
    const decor = decorBlock({
      rect: { x: W * 0.08, y: H * 0.08, w: W * 0.84, h: H * 0.5 },
      src: assets?.decorASrc ?? null, seed, zIndex: 1,
    });
    const ph = placeholderForType(type);
    return [
      decor,
      textBlock({
        text: ph.line1 ?? '',
        rect: { x: W * 0.08, y: H * 0.64, w: W * 0.84, h: H * 0.22 },
        fontSize: 64, color: theme.colors.primary, align: 'start',
        letterSpacing: -1, zIndex: 10,
      }, theme),
      logoBlock({ rect: { x: W * 0.08, y: H * 0.9, w: W * 0.35, h: H * 0.06 }, logoSrc: assets?.logoSrc }, theme),
    ];
  },
};
