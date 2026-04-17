/**
 * "Bleeding design" — imagen principal que sangra (bleeds) fuera de los
 * márgenes visibles. Composición arriesgada: el contenido "respira" al
 * extenderse más allá del canvas. El headline se superpone en la zona segura.
 */
import type { PositionedBlock, SlideFormat, SlideType, BrandTheme, TemplateAssets, TemplateMeta } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, textBlock, shapeBlock } from '../init-helpers';

export const bleedingDesign: TemplateMeta = {
  id: 'bleeding-design',
  family: 'editorial',
  label: 'Bleeding design / 出血设计',
  backgroundColor: (_, theme) => theme.colors.bg,
  initBlocks: (type: SlideType, format: SlideFormat, theme: BrandTheme, seed: number, assets?: TemplateAssets): PositionedBlock[] => {
    const { width: W, height: H } = format;
    // Imagen que se extiende más allá del canvas (valores negativos y > W/H).
    const decor = decorBlock({
      rect: { x: -W * 0.1, y: -H * 0.05, w: W * 1.2, h: H * 0.7 },
      src: assets?.decorASrc ?? assets?.decorBSrc ?? null,
      seed,
      density: 0.9,
      zIndex: 1,
    });
    // Barra de color bajando desde abajo
    const bar = shapeBlock({
      rect: { x: 0, y: H * 0.7, w: W, h: H * 0.3 },
      shape: 'rect',
      fill: theme.colors.primary,
      zIndex: 2,
      kind: 'accent',
    });
    const content = placeholderForType(type);
    const headline = textBlock({
      text: content.line1 ?? '',
      rect: { x: W * 0.08, y: H * 0.72, w: W * 0.84, h: H * 0.2 },
      fontSize: 72,
      color: theme.colors.bg,
      letterSpacing: -1.5,
      fontWeight: 500,
      kind: 'headline',
      zIndex: 3,
    }, theme);
    const logo = logoBlock({
      rect: { x: W * 0.08, y: H * 0.93, w: W * 0.35, h: H * 0.05 },
      color: theme.colors.bg,
      logoSrc: assets?.logoSrc,
      zIndex: 4,
    }, theme);
    return [decor, bar, headline, logo];
  },
};
