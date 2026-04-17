/**
 * Embeber fuentes en el SVG exportado. Sin esto el canvas rasterizado cae
 * a serif/sans del sistema (porque el `<Image>` que procesa el SVG no tiene
 * acceso a Google Fonts remotas ni a document.fonts).
 *
 * Estrategia:
 *   1. Custom fonts del user (dataURI ya en IDB) → @font-face directo.
 *   2. Google Fonts del preset activo → fetch CSS, descargar woff2 de cada
 *      URL referenciada, convertir a base64, re-escribir `url(...)` con data URI.
 *      Resultado cacheado en memoria por googleFamilies string.
 *
 * Devuelve un array de strings CSS listo para inyectar en `<style>` dentro
 * del `<defs>` del SVG clonado.
 */
import { get as idbGet } from 'idb-keyval';
import { FONT_PRESETS } from '@/domain';
import type { CustomFontMeta } from '@/domain';

export interface FontEmbedInput {
  fontKey: string;                 // preset activo (fraunces, dmserif, etc.)
  customDisplay: CustomFontMeta | null;
  customSans: CustomFontMeta | null;
  customDisplayDataURI: string | null;
  customSansDataURI: string | null;
  fontGallery: CustomFontMeta[];
}

/** Cache en memoria para no refetchear Google Fonts en cada export. */
const googleCssCache = new Map<string, string>();

/**
 * Punto de entrada: devuelve el CSS `@font-face{...}` para TODAS las fuentes
 * que podrían aparecer en el export.
 */
export async function collectActiveFontCss(input: FontEmbedInput): Promise<string> {
  const [customCss, googleCss] = await Promise.all([
    collectCustomFonts(input),
    fetchGoogleFontsAsDataUri(input.fontKey),
  ]);
  return [customCss, googleCss].filter(Boolean).join('\n\n');
}

async function collectCustomFonts(input: FontEmbedInput): Promise<string> {
  const faces: string[] = [];
  const seen = new Set<string>();

  const push = async (meta: CustomFontMeta | null, fallbackDataURI: string | null) => {
    if (!meta) return;
    if (seen.has(meta.internalName)) return;
    const du = fallbackDataURI ?? await idbGet<string>(meta.internalName).catch(() => null);
    if (!du) return;
    seen.add(meta.internalName);
    faces.push(
      `@font-face{font-family:"${meta.internalName}";src:url("${du}") format("${meta.format}");font-display:block;}`,
    );
  };

  await push(input.customDisplay, input.customDisplayDataURI);
  await push(input.customSans, input.customSansDataURI);
  // Gallery completa — inyectamos todas por seguridad (tree-shake natural por size).
  for (const meta of input.fontGallery) {
    await push(meta, null);
  }
  return faces.join('\n');
}

async function fetchGoogleFontsAsDataUri(fontKey: string): Promise<string> {
  const preset = FONT_PRESETS[fontKey];
  if (!preset) return '';
  const families = preset.googleFamilies;
  if (!families) return '';
  if (googleCssCache.has(families)) return googleCssCache.get(families)!;

  const cssUrl = `https://fonts.googleapis.com/css2?family=${families.split('|').join('&family=')}&display=swap`;
  try {
    const cssResp = await fetch(cssUrl, {
      // UA "chrome" para que Google devuelva woff2 (el que soporta el browser).
      headers: { 'User-Agent': 'Mozilla/5.0' } as unknown as HeadersInit,
    });
    if (!cssResp.ok) throw new Error(`google css ${cssResp.status}`);
    const rawCss = await cssResp.text();
    const inlinedCss = await inlineFontUrls(rawCss);
    googleCssCache.set(families, inlinedCss);
    return inlinedCss;
  } catch (err) {
    console.warn('[fontEmbed] no pude bajar Google Fonts, export usará fallbacks', err);
    return '';
  }
}

/**
 * Toma un CSS de Google Fonts (con urls a fonts.gstatic.com) y reemplaza
 * cada `url(https://...woff2)` por `url(data:font/woff2;base64,...)`.
 * Corre los fetch en paralelo.
 */
async function inlineFontUrls(css: string): Promise<string> {
  const urlRegex = /url\((https?:\/\/[^)]+\.(?:woff2?|ttf|otf))\)/g;
  const urls = Array.from(new Set(Array.from(css.matchAll(urlRegex), (m) => m[1]!)));
  const dataUriMap = new Map<string, string>();

  await Promise.all(urls.map(async (url) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return;
      const buf = await resp.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const mime = url.endsWith('.woff2') ? 'font/woff2'
                 : url.endsWith('.woff')  ? 'font/woff'
                 : url.endsWith('.otf')   ? 'font/otf'
                 : 'font/ttf';
      dataUriMap.set(url, `data:${mime};base64,${b64}`);
    } catch (err) {
      console.warn('[fontEmbed] fetch font failed', url, err);
    }
  }));

  return css.replace(urlRegex, (_full, url: string) => {
    const di = dataUriMap.get(url);
    return di ? `url(${di})` : _full;
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}
