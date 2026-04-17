/**
 * Helpers compartidos por las plantillas para crear PositionedBlocks iniciales.
 * Encapsulan los patrones comunes (headline, logo, decor, caption, shape)
 * para que cada plantilla se concentre en posicionar, no en boilerplate.
 */
import type {
  BlockKind, BrandTheme, PositionedBlock, Rect, SlideFormat, SlideType, TextAlign,
} from '@/domain';

let counter = 0;
const id = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export interface TextInit {
  text: string;
  rect: Rect;
  fontSize: number;
  align?: TextAlign;
  color?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: number;
  lineHeight?: number;
  upper?: boolean;
  fontRole?: 'display' | 'sans' | 'script' | 'mono';
  zIndex?: number;
  kind?: BlockKind;
}

export function textBlock(init: TextInit, theme: BrandTheme): PositionedBlock {
  return {
    id: id('txt'),
    kind: init.kind ?? 'headline',
    rect: init.rect,
    zIndex: init.zIndex ?? 10,
    content: {
      kind: 'text',
      text: init.text,
      fontRole: init.fontRole ?? 'display',
      fontSize: init.fontSize,
      fontWeight: init.fontWeight ?? 600,
      fontStyle: init.fontStyle ?? 'italic',
      letterSpacing: init.letterSpacing ?? 0,
      lineHeight: init.lineHeight ?? 1.15,
      textAlign: init.align ?? 'start',
      color: init.color ?? theme.colors.primary,
      upper: init.upper,
    },
  };
}

export interface DecorInit {
  rect: Rect;
  src?: string | null;
  seed?: number;
  density?: number;
  overlay?: { color: string; opacity: number };
  zIndex?: number;
}

export function decorBlock(init: DecorInit): PositionedBlock {
  return {
    id: id('decor'),
    kind: 'decor',
    rect: init.rect,
    zIndex: init.zIndex ?? 1,
    content: {
      kind: 'decor',
      mode: init.src ? 'image' : 'glitch',
      src: init.src ?? undefined,
      seed: init.seed ?? 42,
      density: init.density ?? 1,
      overlay: init.overlay,
    },
  };
}

export interface ShapeInit {
  rect: Rect;
  shape: 'rect' | 'circle' | 'line' | 'star' | 'triangle';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  zIndex?: number;
  kind?: BlockKind;
}

export function shapeBlock(init: ShapeInit): PositionedBlock {
  return {
    id: id('shape'),
    kind: init.kind ?? 'accent',
    rect: init.rect,
    zIndex: init.zIndex ?? 2,
    content: {
      kind: 'shape',
      shape: init.shape,
      fill: init.fill,
      stroke: init.stroke,
      strokeWidth: init.strokeWidth,
      opacity: init.opacity,
    },
  };
}

export interface LogoInit {
  rect: Rect;
  logoSrc?: string | null;
  color?: string;
  zIndex?: number;
}

export function logoBlock(init: LogoInit, theme: BrandTheme): PositionedBlock {
  if (init.logoSrc) {
    return {
      id: id('logo'),
      kind: 'logo',
      rect: init.rect,
      zIndex: init.zIndex ?? 20,
      content: { kind: 'image', src: init.logoSrc, fit: 'contain' },
    };
  }
  return {
    id: id('logo'),
    kind: 'logo',
    rect: init.rect,
    zIndex: init.zIndex ?? 20,
    content: {
      kind: 'text',
      text: '{eterCore}',
      fontRole: 'script',
      fontSize: 56,
      fontStyle: 'italic',
      textAlign: 'start',
      color: init.color ?? theme.colors.ink,
    },
  };
}

/** Texto placeholder según el tipo de slide (lo usan las plantillas cuando no hay slide data). */
export function placeholderForType(type: SlideType): { line1: string; line2?: string; number?: string; caption?: string } {
  switch (type) {
    case 'cover':       return { line1: 'Título principal del carrusel' };
    case 'observation': return { line1: 'Una observación conversacional sobre el tema elegido.' };
    case 'contrast':    return { line1: 'Afirmación central.', line2: 'Punto de contraste.' };
    case 'quote':       return { line1: 'Una cita que resume el insight.' };
    case 'stat':        return { number: '7 de 10', line1: 'descripción del dato', caption: 'FUENTE' };
    case 'cta':         return { line1: 'Llamada a la acción.', line2: 'ESCRIBINOS' };
  }
}

/** Helper de rects: centra un rect de tamaño fijo dentro del canvas. */
export function centerRect(format: SlideFormat, w: number, h: number, offsetY = 0): Rect {
  return { x: (format.width - w) / 2, y: (format.height - h) / 2 + offsetY, w, h };
}
