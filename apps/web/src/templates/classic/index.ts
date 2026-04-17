/**
 * Familia "Classic" — las 10 plantillas originales migradas al modelo de
 * bloques posicionables. Cada una inicializa decor + headline + logo con
 * distinta disposición, inspiradas en el layout legacy `getLayout()`.
 */
import type { PositionedBlock, TemplateMeta } from '@/domain';
import { decorBlock, logoBlock, placeholderForType, shapeBlock, textBlock } from '../init-helpers';

function classicTemplate(
  id: TemplateMeta['id'],
  label: string,
  layout: (W: number, H: number) => { decor: PositionedBlock; extras?: PositionedBlock[]; textRect: { x: number; y: number; w: number; h: number }; textAlign: 'start' | 'middle' | 'end'; logoRect: { x: number; y: number; w: number; h: number } },
): TemplateMeta {
  return {
    id,
    family: 'classic',
    label,
    initBlocks: (type, format, theme, _seed, assets) => {
      const { width: W, height: H } = format;
      const L = layout(W, H);
      return [
        { ...L.decor, content: { ...L.decor.content, src: assets?.decorASrc ?? (L.decor.content.kind === 'decor' ? L.decor.content.src : undefined) } as any },
        ...(L.extras ?? []),
        textBlock({
          text: placeholderForType(type).line1 ?? '',
          rect: L.textRect, fontSize: 56, color: theme.colors.primary, align: L.textAlign,
          letterSpacing: -1, zIndex: 10,
        }, theme),
        logoBlock({ rect: L.logoRect, logoSrc: assets?.logoSrc }, theme),
      ];
    },
  };
}

export const CLASSIC_TEMPLATES_META: TemplateMeta[] = [
  classicTemplate('editorial', 'Editorial', (W, H) => ({
    decor: decorBlock({ rect: { x: W * 0.52, y: 0, w: W * 0.48, h: H * 0.63 } }),
    textRect: { x: W * 0.08, y: H * 0.15, w: W * 0.42, h: H * 0.3 },
    textAlign: 'start',
    logoRect: { x: W * 0.08, y: H * 0.9, w: W * 0.35, h: H * 0.06 },
  })),
  classicTemplate('centered', 'Centered', (W, H) => ({
    decor: decorBlock({ rect: { x: 0, y: 0, w: W, h: H * 0.18 } }),
    textRect: { x: W * 0.08, y: H * 0.4, w: W * 0.84, h: H * 0.25 },
    textAlign: 'middle',
    logoRect: { x: W * 0.3, y: H * 0.92, w: W * 0.4, h: H * 0.05 },
  })),
  classicTemplate('asymmetric', 'Asymmetric', (W, H) => ({
    decor: decorBlock({ rect: { x: 0, y: 0, w: W * 0.5, h: H } }),
    textRect: { x: W * 0.55, y: H * 0.35, w: W * 0.4, h: H * 0.25 },
    textAlign: 'start',
    logoRect: { x: W * 0.55, y: H * 0.9, w: W * 0.35, h: H * 0.06 },
  })),
  classicTemplate('split-v', 'Split V', (W, H) => ({
    decor: decorBlock({ rect: { x: 0, y: 0, w: W, h: H / 2 } }),
    textRect: { x: W * 0.1, y: H * 0.6, w: W * 0.8, h: H * 0.2 },
    textAlign: 'middle',
    logoRect: { x: W * 0.3, y: H * 0.9, w: W * 0.4, h: H * 0.05 },
  })),
  classicTemplate('split-h', 'Split H', (W, H) => ({
    decor: decorBlock({ rect: { x: 0, y: 0, w: W / 2, h: H } }),
    textRect: { x: W * 0.55, y: H * 0.3, w: W * 0.4, h: H * 0.3 },
    textAlign: 'start',
    logoRect: { x: W * 0.55, y: H * 0.9, w: W * 0.35, h: H * 0.06 },
  })),
  classicTemplate('magazine', 'Magazine', (W, H) => ({
    decor: decorBlock({ rect: { x: 0, y: 0, w: W * 0.28, h: H } }),
    textRect: { x: W * 0.32, y: H * 0.18, w: W * 0.6, h: H * 0.3 },
    textAlign: 'start',
    logoRect: { x: W * 0.32, y: H * 0.9, w: W * 0.35, h: H * 0.06 },
  })),
  classicTemplate('frame', 'Frame', (W, H) => ({
    decor: decorBlock({ rect: { x: W * 0.075, y: H * 0.06, w: W * 0.85, h: H * 0.88 }, overlay: { color: '#F1E8D3', opacity: 0.88 } }),
    textRect: { x: W * 0.1, y: H * 0.4, w: W * 0.8, h: H * 0.25 },
    textAlign: 'middle',
    logoRect: { x: W * 0.3, y: H * 0.85, w: W * 0.4, h: H * 0.05 },
  })),
  classicTemplate('fullbleed', 'Fullbleed', (W, H) => ({
    decor: decorBlock({ rect: { x: 0, y: 0, w: W, h: H }, overlay: { color: '#0A0A14', opacity: 0.55 } }),
    textRect: { x: W * 0.1, y: H * 0.35, w: W * 0.8, h: H * 0.3 },
    textAlign: 'middle',
    logoRect: { x: W * 0.3, y: H * 0.9, w: W * 0.4, h: H * 0.05 },
  })),
  classicTemplate('minimal', 'Minimal', (W, H) => ({
    decor: decorBlock({ rect: { x: W - W * 0.28, y: H - W * 0.28, w: W * 0.2, h: W * 0.2 } }),
    textRect: { x: W * 0.1, y: H * 0.4, w: W * 0.6, h: H * 0.25 },
    textAlign: 'start',
    logoRect: { x: W * 0.1, y: H * 0.9, w: W * 0.35, h: H * 0.05 },
  })),
  classicTemplate('poster', 'Poster', (W, H) => ({
    decor: decorBlock({ rect: { x: 0, y: H * 0.79, w: W, h: H * 0.21 } }),
    textRect: { x: W * 0.1, y: H * 0.22, w: W * 0.8, h: H * 0.35 },
    textAlign: 'middle',
    logoRect: { x: W * 0.3, y: H * 0.7, w: W * 0.4, h: H * 0.05 },
    extras: [shapeBlock({ rect: { x: W * 0.4, y: H * 0.6, w: W * 0.2, h: 2 }, shape: 'line', fill: '#2E46C8', zIndex: 2 })],
  })),
];
