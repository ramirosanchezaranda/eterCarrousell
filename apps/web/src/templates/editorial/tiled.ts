/**
 * "Tiled" — patrón de tiles repetidos. Una imagen (o textura) se multiplica
 * en una grilla 3×3 detrás del texto principal.
 */
import type { PositionedBlock, SlideFormat, SlideType, BrandTheme, TemplateAssets, TemplateMeta } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, textBlock } from '../init-helpers';

export const tiled: TemplateMeta = {
  id: 'tiled',
  family: 'editorial',
  label: 'Tiled / 平铺',
  backgroundColor: (_, theme) => theme.colors.bg,
  initBlocks: (type: SlideType, format: SlideFormat, theme: BrandTheme, seed: number, assets?: TemplateAssets): PositionedBlock[] => {
    const { width: W, height: H } = format;
    const tileCols = 3, tileRows = 3;
    const tileW = W / tileCols, tileH = H / tileRows;
    const decorSrc = assets?.decorASrc ?? assets?.decorBSrc ?? null;
    const tiles: PositionedBlock[] = [];
    for (let r = 0; r < tileRows; r++) {
      for (let c = 0; c < tileCols; c++) {
        const opacity = ((r + c) % 2 === 0) ? 0.25 : 0.08;
        tiles.push(decorBlock({
          rect: { x: c * tileW, y: r * tileH, w: tileW, h: tileH },
          src: decorSrc,
          seed: seed + r * tileCols + c,
          density: 0.3,
          overlay: { color: theme.colors.bg, opacity: 1 - opacity },
          zIndex: 1,
        }));
      }
    }
    const content = placeholderForType(type);
    const headline = textBlock({
      text: content.line1 ?? '',
      rect: { x: W * 0.1, y: H * 0.35, w: W * 0.8, h: H * 0.3 },
      fontSize: 92,
      align: 'middle',
      color: theme.colors.primary,
      letterSpacing: -2,
      kind: 'headline',
    }, theme);
    const logo = logoBlock({
      rect: { x: W * 0.05, y: H * 0.9, w: W * 0.35, h: H * 0.07 },
      color: theme.colors.ink,
      logoSrc: assets?.logoSrc,
    }, theme);
    return [...tiles, headline, logo];
  },
};
