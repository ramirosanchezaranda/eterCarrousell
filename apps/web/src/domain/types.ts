/**
 * Modelo de dominio. Combina tipos del motor legacy (transicionales)
 * y del modelo nuevo del plan v2. Se consume desde el resto de la app.
 * El legacy usa @ts-nocheck así que no está obligado a importar de acá,
 * pero cualquier módulo nuevo sí.
 */

// ============================================================
// Primitivos geométricos
// ============================================================
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AnchorX = 'left' | 'center' | 'right' | 'full';
export type AnchorY = 'top' | 'middle' | 'bottom' | 'full';

/** Rect expresado como fracciones 0..1 del safe area del SlideFormat. */
export interface ProportionalRect {
  x: number;
  y: number;
  w: number;
  h: number;
  anchorX?: AnchorX;
  anchorY?: AnchorY;
  minPx?: { w?: number; h?: number };
}

// ============================================================
// Identificadores
// ============================================================
export const TEMPLATE_IDS = [
  'editorial', 'centered', 'asymmetric', 'split-v', 'split-h',
  'magazine', 'frame', 'fullbleed', 'minimal', 'poster',
] as const;
export type TemplateId = typeof TEMPLATE_IDS[number];

/** Alias legacy — `GridPreset` era el nombre viejo de TemplateId. */
export type GridPreset = TemplateId;

export const FORMAT_IDS = [
  'ig-1x1', 'ig-4x5', 'ig-story', 'linkedin-post', 'linkedin-carousel', 'tiktok-reels',
] as const;
export type FormatId = typeof FORMAT_IDS[number];

export const SLIDE_TYPES = ['cover', 'contrast', 'observation', 'quote', 'stat', 'cta'] as const;
export type SlideType = typeof SLIDE_TYPES[number];

// ============================================================
// Formato de slide (multi red social)
// ============================================================
export interface SlideFormat {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  safeMargins: { top: number; right: number; bottom: number; left: number };
  grid: { columns: number; gutter: number; baseline: number };
}

// ============================================================
// Plantillas declarativas (motor nuevo)
// ============================================================
export type BlockKind =
  | 'headline' | 'kicker' | 'sub' | 'number' | 'caption'
  | 'logo' | 'counter' | 'decor' | 'overlay' | 'accent'
  | 'cta-button' | 'quote-mark';

export type TextAlign = 'start' | 'middle' | 'end';
export type ColorIntent = 'onLight' | 'onDark' | 'auto';
export type FontRole = 'display' | 'sans' | 'script' | 'mono';

export interface SlotTemplate {
  id: string;
  blockKind: BlockKind;
  rect: ProportionalRect;
  align: TextAlign;
  fontRole?: FontRole;
  fontSize?: { min: number; max: number; preferred: number };
  color?: ColorIntent;
  zIndex: number;
  editable?: { move?: boolean; align?: boolean; swapWith?: string[] };
}

export interface Template {
  id: TemplateId;
  bgBase: 'cream' | 'blue' | 'decor';
  slots: Record<SlideType, SlotTemplate[]>;
  overlay?: { color: string; opacity: number };
  overridesByFormat?: Partial<Record<FormatId, Partial<Template>>>;
}

// ============================================================
// Contenido y slides
// ============================================================
export interface ContentBlock {
  slotId: string;
  kind: BlockKind;
  text?: string;
  imageId?: string;
  override?: Partial<Pick<SlotTemplate, 'rect' | 'align'>>;
}

/**
 * Slide "legacy" — el motor viejo consume estos campos planos.
 * El motor nuevo usa `blocks: ContentBlock[]` (ver SlideModel más abajo).
 */
export interface LegacySlide {
  type: SlideType;
  line1: string;
  line2?: string;
  number?: string;
  caption?: string;
}
export type Slide = LegacySlide; // alias compatible durante la transición

export interface SlideModel {
  id: string;
  type: SlideType;
  templateId: TemplateId;
  blocks: ContentBlock[];
  seed: number;
}

// ============================================================
// Tema y fuentes
// ============================================================
export interface ResolvedFonts {
  display: string;
  sans: string;
  script: string;
  mono: string;
}

export interface CustomFontMeta {
  internalName: string;
  fileName: string;
  format: string;
  role: FontRole;
}

export interface CustomFont extends CustomFontMeta {
  dataURI: string;
  fontFace: FontFace;
}

export interface FontPreset {
  label: string;
  display: string;
  sans: string;
  script: string;
  mono: string;
  googleFamilies: string;
}

export interface BrandTheme {
  id: string;
  colors: {
    primary: string;
    bg: string;
    ink: string;
    light: string;
    accents: string[];
  };
  fonts: ResolvedFonts & { googleFamilies: string };
  customFonts: CustomFontMeta[];
  logoId?: string;
}

// ============================================================
// Assets legacy (transición)
// ============================================================
export interface BrandAssets {
  logo: string | null;
  decorA: string | null;
  decorB: string | null;
  gridRef: string | null;
  fonts: ResolvedFonts;
  customFonts: CustomFont[];
  grid: TemplateId;
}

// ============================================================
// Resultado del motor de layout
// ============================================================
export interface ResolvedBlock {
  slotId: string;
  kind: BlockKind;
  bbox: Rect;
  fontSize?: number;
  color?: string;
  lines?: string[];
  zIndex: number;
}

export interface ResolvedLayout {
  format: SlideFormat;
  background: {
    color: string;
    decor?: { src: string | null; rect: Rect; density: number; seed: number };
    overlay?: { color: string; opacity: number; rect?: Rect };
    accent?: { rect: Rect; color: string };
  };
  blocks: ResolvedBlock[];
  warnings: string[];
}

// ============================================================
// Proyecto y carrusel
// ============================================================
export interface Carousel {
  id: string;
  topic: string;
  templateId: TemplateId;
  formatId: FormatId;
  themeId: string;
  slides: SlideModel[];
  assets: { decorAId?: string; decorBId?: string };
}

export interface Project {
  id: string;
  name: string;
  carousels: Carousel[];
  themes: BrandTheme[];
  createdAt: number;
}

// ============================================================
// Bloques posicionables (editor tipo Canva)
// ============================================================

/** Vector 2D, usado para puntos de snap y anchors. */
export interface Vec2 { x: number; y: number }

/** Efectos SVG aplicables a cualquier bloque (texto, imagen, shape, decor). */
export type ImageEffect =
  | { kind: 'grayscale' }
  | { kind: 'sepia' }
  | { kind: 'invert' }
  | { kind: 'blur'; radius: number }
  | { kind: 'brightness'; value: number }    // -1..1, 0 = neutro
  | { kind: 'contrast'; value: number }      // 0..2, 1 = neutro
  | { kind: 'saturation'; value: number }    // 0..2, 1 = neutro
  | { kind: 'hue'; deg: number }             // 0..360
  | { kind: 'duotone'; dark: string; light: string }
  | { kind: 'ascii'; density: number }       // 0..1, genera pattern de texto
  | { kind: 'halftone'; size: number };      // tamaño del dot pattern

/** Relleno con gradiente lineal para texto y shapes. */
export interface GradientFill {
  angle: number;   // 0..360
  stops: Array<{ color: string; at: number }>; // at ∈ [0, 1]
}

/** Contorno SVG de texto/shape (como `stroke` de `<text>` o `<rect>`). */
export interface TextStroke {
  color: string;
  width: number;
  dasharray?: string;  // "4 2", "8 4 2 4", etc.
}

/**
 * Run de texto con formato propio — para selección parcial estilo Figma.
 * Cuando `TextContent.runs` está definido, el render usa cada run como
 * `<tspan>` con atributos propios. Si no, el `text` plano usa las props
 * a nivel bloque.
 */
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
}

/** Contenido de texto con propiedades tipográficas independientes por bloque. */
export interface TextContent {
  kind: 'text';
  text: string;                 // fallback plano (también se usa cuando runs === undefined)
  runs?: TextRun[];             // si está presente, toma prioridad sobre `text` y flags
  fontRole: FontRole;
  fontFamilyOverride?: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: number;
  lineHeight?: number;
  textAlign: TextAlign;
  color: string;
  upper?: boolean;
  underline?: boolean;
  strike?: boolean;
  stroke?: TextStroke;
  gradientFill?: GradientFill;
  effects?: ImageEffect[];
}

/** Imagen con fuente externa (dataURI o URL) y posicionamiento interno. */
export interface ImageContent {
  kind: 'image';
  src: string;
  fit: 'cover' | 'contain' | 'fill';
  offsetX?: number;
  offsetY?: number;
  effects?: ImageEffect[];
}

/** Forma geométrica primitiva (rect, círculo, línea, estrella). */
export interface ShapeContent {
  kind: 'shape';
  shape: 'rect' | 'circle' | 'line' | 'star' | 'triangle';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  effects?: ImageEffect[];
}

/**
 * Path SVG vectorial — resultado de "convertir texto a contornos" estilo
 * Illustrator. El `d` se edita punto a punto en el NodeEditor.
 * `originalD` guarda el path inicial para permitir "resetear contornos".
 */
export interface PathContent {
  kind: 'path';
  d: string;
  originalD?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  effects?: ImageEffect[];
  /** Si vino de vectorizar un texto, guardamos el texto original por referencia. */
  sourceText?: string;
}

/** Textura procedural (glitch, noise, pattern) o imagen decorativa con efectos. */
export interface DecorContent {
  kind: 'decor';
  mode: 'glitch' | 'image' | 'pattern';
  src?: string;
  density?: number;
  seed?: number;
  overlay?: { color: string; opacity: number };
  effects?: ImageEffect[];
}

export type BlockContent = TextContent | ImageContent | ShapeContent | DecorContent | PathContent;

/** Estilo adicional común a todos los bloques (sombra, borde, etc.). */
export interface BlockStyle {
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  borderRadius?: number;
  backgroundColor?: string;
  padding?: number;
}

/** Bloque posicionable: unidad atómica del editor tipo Canva. */
export interface PositionedBlock {
  id: string;
  kind: BlockKind;
  rect: Rect;                        // absoluto en coordenadas del SlideFormat
  rotation?: number;                 // grados, 0 por defecto
  zIndex: number;
  locked?: boolean;
  content: BlockContent;
  style?: BlockStyle;
}

/** Fondo de una slide — sobrescribe el color base del theme. */
export type SlideBackground =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; angle: number; stops: Array<{ color: string; at: number }> }
  | { kind: 'image'; src: string; fit: 'cover' | 'contain' | 'fill'; opacity?: number };

/** Slide en modo editor: bloques posicionables + meta. */
export interface EditableSlide {
  id: string;
  type: SlideType;                   // referencial (ayuda al generador AI)
  templateId: TemplateId;            // plantilla que inicializó la slide
  blocks: PositionedBlock[];
  seed: number;
  background?: SlideBackground;      // opcional; si falta usa theme.colors.bg
}

/** Entrada de la galería de imágenes del usuario — una biblioteca reusable. */
export interface GalleryImage {
  id: string;
  dataURI: string;
  name?: string;
}

// ============================================================
// Familias de plantillas y registry editorial
// ============================================================
export const TEMPLATE_FAMILIES = ['classic', 'editorial'] as const;
export type TemplateFamily = typeof TEMPLATE_FAMILIES[number];

export const CLASSIC_TEMPLATES = [
  'editorial', 'centered', 'asymmetric', 'split-v', 'split-h',
  'magazine', 'frame', 'fullbleed', 'minimal', 'poster',
] as const;

export const EDITORIAL_TEMPLATES = [
  'tiled', 'only-one-picture', 'picture-splitting', 'image-crossover',
  'misplaced-typesetting', 'centered-picture', 'uniform-picture-size',
  'bleeding-design', 'color-blocks', 'creative-graphics',
] as const;

export type EditorialTemplateId = typeof EDITORIAL_TEMPLATES[number];

/** Assets del usuario disponibles al inicializar una plantilla. */
export interface TemplateAssets {
  logoSrc?: string | null;
  decorASrc?: string | null;
  decorBSrc?: string | null;
}

/** Meta de una plantilla — consumida por el selector UI (sidebar). */
export interface TemplateMeta {
  id: TemplateId | EditorialTemplateId;
  family: TemplateFamily;
  label: string;
  /** Inicializa los bloques para el tipo de slide + formato dado. */
  initBlocks: (slideType: SlideType, format: SlideFormat, theme: BrandTheme, seed: number, assets?: TemplateAssets) => PositionedBlock[];
  /** Color/overlay de fondo base (antes de los bloques). */
  backgroundColor?: (slideType: SlideType, theme: BrandTheme) => string;
}

// ============================================================
// Guides visuales (overlays del editor)
// ============================================================
export const GUIDE_IDS = [
  'fibonacci-spiral', 'golden-ratio', 'rule-of-thirds', 'rule-of-quarters',
  'diagonal-a', 'diagonal-b', 'modular-3x4', 'modular-4x6',
  'axial-symmetry', 'center-cross', 'x-split', 'custom-columns',
] as const;
export type GuideId = typeof GUIDE_IDS[number];

/**
 * Definición de una grilla guía: se renderiza como overlay SVG en el editor
 * (no se exporta al JPEG/PNG final), y expone puntos fuertes para snap.
 */
export interface EditorGuide {
  id: GuideId;
  label: string;
  description?: string;
  /** Devuelve los segmentos SVG que dibujan la guía sobre el canvas. */
  renderLines: (format: SlideFormat) => GuideLine[];
  /** Puntos fuertes de la grilla — el drag snap-ea al más cercano (< threshold). */
  snapPoints: (format: SlideFormat) => Vec2[];
}

export type GuideLine =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; opacity?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; opacity?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; opacity?: number }
  | { kind: 'path'; d: string; opacity?: number };

/** Estado del editor (selección, drag, guides activos, snap). */
export interface EditorState {
  selectedBlockIds: string[];
  activeGuides: GuideId[];
  snapEnabled: boolean;
  snapThresholdPx: number;
  showBoundingBoxes: boolean;
  gridVisible: boolean;
  zoom: number;
}

// ============================================================
// Layout legacy (el shape que retorna getLayout del monolito)
// ============================================================
export interface LegacyLayout {
  decorRect: Rect;
  decorDensity: number;
  overlay?: { color: string; opacity: number };
  textX: number;
  textY: number;
  textAlign: TextAlign;
  textMaxChars: number;
  textSize: number;
  logoX: number;
  logoAlign: 'left' | 'center' | 'right';
  logoOnDark: boolean;
  bgBase: 'cream' | 'blue' | 'decor';
  accent?: Rect;
}
