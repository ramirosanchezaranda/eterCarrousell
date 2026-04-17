/**
 * Convierte un TextContent a un PathContent usando opentype.js.
 *
 * Limitación técnica: opentype.js parsea TTF/OTF/WOFF (woff1), pero NO woff2
 * (usa Brotli). Google Fonts sirve woff2 por default, y el browser no deja
 * modificar el header `User-Agent` en `fetch` para forzar TTF. Por eso la
 * vectorización solo funciona con **fuentes custom subidas por el usuario**
 * (tab Recursos > Fuentes). Si la selección actual está con un preset de
 * Google, el usuario debe subir una fuente y asignarla como Display/Sans.
 *
 * El `resolveFontArrayBuffer` busca en este orden:
 *   1. fontFamilyOverride (raw family name) → customFont en `fontGallery`.
 *   2. fontRole='display' → `customDisplay` del store.
 *   3. fontRole='sans'    → `customSans` del store.
 *   4. Si nada: devuelve null.
 */
import opentype from 'opentype.js';
import { get as idbGet } from 'idb-keyval';
import type { CustomFontMeta, FontRole, Rect } from '@/domain';

const fontCache = new Map<string, opentype.Font>();

interface FontResolutionInput {
  fontRole: FontRole;
  fontFamilyOverride?: string | null;
  customDisplay: CustomFontMeta | null;
  customSans: CustomFontMeta | null;
  fontGallery: CustomFontMeta[];
}

async function resolveFontArrayBuffer(input: FontResolutionInput): Promise<ArrayBuffer | null> {
  let meta: CustomFontMeta | null = null;
  if (input.fontFamilyOverride) {
    const found = input.fontGallery.find((f) => f.internalName === input.fontFamilyOverride);
    if (found) meta = found;
  }
  if (!meta && input.fontRole === 'display') meta = input.customDisplay;
  if (!meta && input.fontRole === 'sans') meta = input.customSans;
  if (!meta) return null;
  try {
    const dataURI = await idbGet<string>(meta.internalName);
    if (!dataURI) return null;
    // dataURI: data:font/ttf;base64,AAAA...
    const comma = dataURI.indexOf(',');
    const b64 = dataURI.slice(comma + 1);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch (err) {
    console.warn('[textToPath] read font from IDB failed', err);
    return null;
  }
}

/**
 * Convierte un bloque de texto a un path SVG usando opentype.js.
 * Devuelve el `d`, el fill, y métricas para reposicionar el path dentro
 * del rect original del bloque.
 */
export interface TextToPathResult {
  d: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
}

export async function textToPath(args: {
  text: string;
  fontRole: FontRole;
  fontFamilyOverride?: string | null;
  fontSize: number;
  rect: Rect;
  textAlign: 'start' | 'middle' | 'end';
  customDisplay: CustomFontMeta | null;
  customSans: CustomFontMeta | null;
  fontGallery: CustomFontMeta[];
}): Promise<TextToPathResult | null> {
  const { text, fontSize, rect, textAlign } = args;
  const fontIdentifier = args.fontFamilyOverride
    ?? (args.fontRole === 'display' ? args.customDisplay?.internalName
       : args.fontRole === 'sans' ? args.customSans?.internalName
       : null)
    ?? null;
  if (!fontIdentifier) return null;
  let font = fontCache.get(fontIdentifier);
  if (!font) {
    try {
      const ab = await resolveFontArrayBuffer({
        fontRole: args.fontRole,
        fontFamilyOverride: args.fontFamilyOverride,
        customDisplay: args.customDisplay,
        customSans: args.customSans,
        fontGallery: args.fontGallery,
      });
      if (!ab) return null;
      font = opentype.parse(ab);
      fontCache.set(fontIdentifier, font);
    } catch (err) {
      console.warn('[textToPath] no se pudo parsear la fuente (¿es woff2?)', err);
      return null;
    }
  }
  // Calcular x de origen según alineación
  const advance = font.getAdvanceWidth(text, fontSize);
  const originX =
    textAlign === 'middle' ? rect.x + (rect.w - advance) / 2 :
    textAlign === 'end' ? rect.x + rect.w - advance :
    rect.x;
  // y baseline: aprox 0.85 * fontSize desde top (igual que el render de text)
  const originY = rect.y + fontSize * 0.85;
  const path = font.getPath(text, originX, originY, fontSize);
  const d = path.toPathData(2);
  const b = path.getBoundingBox();
  return {
    d,
    bounds: { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 },
  };
}
