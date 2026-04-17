/**
 * Constantes de marca, canvas y presets. Fuente única usada por el motor
 * (viejo y nuevo) y por los componentes UI.
 */
import type { FontPreset, LegacySlide, TemplateId } from './types';

// ============================================================
// BRAND TOKENS
// ============================================================
export const BRAND = {
  cream: '#F1E8D3',
  blue: '#2E46C8',
  blueDark: '#1B2A7A',
  blueLight: '#6A7ADB',
  ink: '#0A0A14',
} as const;

export type BrandKey = keyof typeof BRAND;

// ============================================================
// CANVAS (legacy default = Instagram 4:5)
// ============================================================
export const CANVAS = { W: 1080, H: 1350 } as const;

export const SPACING = {
  xs: 8,
  sm: 16,
  md: 32,
  lg: 64,
  xl: 96,
  xxl: 140,
  margin: 120,
} as const;

export const SAFE = {
  left: SPACING.margin,
  right: CANVAS.W - SPACING.margin,
  top: SPACING.margin,
  bottom: CANVAS.H - SPACING.margin,
  width: CANVAS.W - SPACING.margin * 2,
  height: CANVAS.H - SPACING.margin * 2,
} as const;

// ============================================================
// PRESETS DE GRILLA (nombres estables; el motor nuevo los consume
// desde `domain/types.ts::TEMPLATE_IDS`)
// ============================================================
export const GRID_PRESETS = [
  'editorial', 'centered', 'asymmetric', 'split-v', 'split-h',
  'magazine', 'frame', 'fullbleed', 'minimal', 'poster',
] as const satisfies readonly TemplateId[];

export const DEFAULT_TEMPLATE_ID: TemplateId = 'editorial';

// ============================================================
// PRESETS TIPOGRÁFICOS
// ============================================================
export const FONT_PRESETS: Record<string, FontPreset> = {
  fraunces: {
    label: 'Fraunces + Inter',
    display: '"Fraunces", Georgia, serif',
    sans: '"Inter", system-ui, sans-serif',
    script: '"Caveat", cursive',
    mono: '"JetBrains Mono", monospace',
    googleFamilies: 'Fraunces:ital,wght@1,500;1,600;1,700|Inter:wght@400;700|Caveat:wght@500|JetBrains+Mono:wght@400;500',
  },
  dmserif: {
    label: 'DM Serif + Manrope',
    display: '"DM Serif Display", Georgia, serif',
    sans: '"Manrope", system-ui, sans-serif',
    script: '"Caveat", cursive',
    mono: '"JetBrains Mono", monospace',
    googleFamilies: 'DM+Serif+Display:ital@0;1|Manrope:wght@400;700;800|Caveat:wght@500|JetBrains+Mono:wght@400;500',
  },
  playfair: {
    label: 'Playfair + Space Grotesk',
    display: '"Playfair Display", Georgia, serif',
    sans: '"Space Grotesk", system-ui, sans-serif',
    script: '"Caveat", cursive',
    mono: '"JetBrains Mono", monospace',
    googleFamilies: 'Playfair+Display:ital,wght@1,500;1,700|Space+Grotesk:wght@400;700|Caveat:wght@500|JetBrains+Mono:wght@400;500',
  },
  cormorant: {
    label: 'Cormorant Garamond + DM Sans',
    display: '"Cormorant Garamond", Georgia, serif',
    sans: '"DM Sans", system-ui, sans-serif',
    script: '"Caveat", cursive',
    mono: '"JetBrains Mono", monospace',
    googleFamilies: 'Cormorant+Garamond:ital,wght@1,500;1,600;1,700|DM+Sans:wght@400;700|Caveat:wght@500|JetBrains+Mono:wght@400;500',
  },
};

export const DEFAULT_FONT_KEY = 'fraunces';

// ============================================================
// CONTENIDO INICIAL
// ============================================================
export const DEFAULT_TOPIC = 'Por qué el diseño web impacta cuánto podés cobrar';

export const DEFAULT_SLIDES: LegacySlide[] = [
  { type: 'cover', line1: 'Tu web es el primer empleado que conocen.' },
  { type: 'observation', line1: 'Hay empresas que facturan millones y reciben a sus clientes en una web que parece un Excel de 2014.' },
  { type: 'contrast', line1: 'Cuando una marca se ve cuidada, cobrás lo que vale tu trabajo.', line2: 'Cuando se ve improvisada, negociás cada factura.' },
  { type: 'quote', line1: 'La gente no se acuerda de tu logo. Se acuerda de si te entendió rápido.' },
  { type: 'stat', number: '7 de 10', line1: 'clientes nuevos llegan a tu web antes de la primera llamada.', caption: 'OBSERVACIÓN INTERNA · ETERCORE' },
  { type: 'cta', line1: 'Revisemos juntos cómo te están viendo tus próximos clientes.', line2: 'ESCRIBINOS POR DM' },
];
