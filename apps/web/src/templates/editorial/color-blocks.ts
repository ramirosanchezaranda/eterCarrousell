/**
 * "Color blocks" — composición modular con bloques de color + fotos
 * alternados en grilla 3×5 (estilo Mondrian / InDesign editorial).
 * Los acentos usan la paleta del theme (extraída de la imagen subida).
 */
import type { PositionedBlock, SlideFormat, SlideType, BrandTheme, TemplateAssets, TemplateMeta } from '@/domain';
import { logoBlock, placeholderForType, shapeBlock, textBlock } from '../init-helpers';

export const colorBlocks: TemplateMeta = {
  id: 'color-blocks',
  family: 'editorial',
  label: 'Color blocks / 图片与色块',
  backgroundColor: (_, theme) => theme.colors.bg,
  initBlocks: (type: SlideType, format: SlideFormat, theme: BrandTheme, _seed: number, assets?: TemplateAssets): PositionedBlock[] => {
    const { width: W, height: H } = format;
    const accents = theme.colors.accents.length >= 3
      ? theme.colors.accents
      : [theme.colors.primary, theme.colors.light, theme.colors.ink];
    const cellW = W * 0.18, cellH = H * 0.14;
    const startX = W * 0.1, startY = H * 0.2;
    const blocks: PositionedBlock[] = [
      shapeBlock({ rect: { x: startX, y: startY, w: cellW, h: cellH * 1.5 }, shape: 'rect', fill: accents[0], zIndex: 1, kind: 'accent' }),
      shapeBlock({ rect: { x: startX + cellW * 1.2, y: startY + cellH * 0.5, w: cellW * 2, h: cellH }, shape: 'rect', fill: accents[1], opacity: 0.5, zIndex: 1, kind: 'accent' }),
      shapeBlock({ rect: { x: startX + cellW * 3.5, y: startY, w: cellW, h: cellH * 2 }, shape: 'rect', fill: accents[2], opacity: 0.3, zIndex: 1, kind: 'accent' }),
      shapeBlock({ rect: { x: startX + cellW * 0.7, y: startY + cellH * 2, w: cellW * 1.5, h: cellH * 0.8 }, shape: 'rect', fill: accents[0], opacity: 0.4, zIndex: 1, kind: 'accent' }),
    ];
    const content = placeholderForType(type);
    const headline = textBlock({
      text: content.line1 ?? '',
      rect: { x: W * 0.1, y: H * 0.55, w: W * 0.8, h: H * 0.2 },
      fontSize: 78,
      color: theme.colors.primary,
      letterSpacing: -1.5,
      kind: 'headline',
      zIndex: 10,
    }, theme);
    const kicker = textBlock({
      text: 'COLOR BLOCKS',
      rect: { x: W * 0.1, y: H * 0.1, w: W * 0.5, h: H * 0.04 },
      fontSize: 14,
      fontRole: 'mono',
      letterSpacing: 3,
      fontStyle: 'normal',
      fontWeight: 700,
      color: theme.colors.primary,
      upper: true,
      kind: 'kicker',
      zIndex: 10,
    }, theme);
    const logo = logoBlock({
      rect: { x: W * 0.1, y: H * 0.88, w: W * 0.35, h: H * 0.07 },
      color: theme.colors.ink,
      logoSrc: assets?.logoSrc,
    }, theme);
    return [...blocks, kicker, headline, logo];
  },
};
