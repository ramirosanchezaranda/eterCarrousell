import type { TemplateMeta } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, textBlock } from '../init-helpers';

export const misplacedTypesetting: TemplateMeta = {
  id: 'misplaced-typesetting',
  family: 'editorial',
  label: 'Misplaced / 多图错位',
  initBlocks: (type, format, theme, seed, assets) => {
    const { width: W, height: H } = format;
    const ph = placeholderForType(type);
    const words = (ph.line1 ?? '').split(' ');
    const half = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(' ');
    const line2 = words.slice(half).join(' ');
    return [
      decorBlock({
        rect: { x: W * 0.05, y: H * 0.12, w: W * 0.3, h: H * 0.2 },
        src: assets?.decorASrc ?? null, seed, zIndex: 1,
      }),
      decorBlock({
        rect: { x: W * 0.45, y: H * 0.35, w: W * 0.5, h: H * 0.3 },
        src: assets?.decorBSrc ?? assets?.decorASrc ?? null, seed: seed + 1, zIndex: 1,
      }),
      textBlock({
        text: line1, rect: { x: W * 0.05, y: H * 0.7, w: W * 0.55, h: H * 0.1 },
        fontSize: 48, color: theme.colors.primary, align: 'start', zIndex: 10,
      }, theme),
      textBlock({
        text: line2, rect: { x: W * 0.3, y: H * 0.8, w: W * 0.65, h: H * 0.1 },
        fontSize: 48, color: theme.colors.ink, align: 'start', zIndex: 10,
      }, theme),
      logoBlock({ rect: { x: W * 0.05, y: H * 0.92, w: W * 0.3, h: H * 0.05 }, logoSrc: assets?.logoSrc }, theme),
    ];
  },
};
