/**
 * Export SVG → Canvas → JPEG/PNG. Embebe fuentes custom vía @font-face
 * con dataURI para que el canvas las renderice aunque no estén en el DOM.
 *
 * En el plan v2 este módulo se parametriza para aceptar el `SlideFormat` activo
 * (width/height dinámicos). Por ahora mantiene el canvas 1080×1350 legacy por
 * compatibilidad con el motor viejo.
 */
import { BRAND, CANVAS } from '@/domain';
import type { CustomFont } from '@/domain';

export type ExportFormat = 'jpeg' | 'png';

export interface ExportOptions {
  format?: ExportFormat;
  quality?: number;                  // 0..1, aplica solo a jpeg
  width?: number;                    // override del ancho de canvas
  height?: number;                   // override del alto de canvas
  backgroundColor?: string;          // fill previo al drawImage
  fonts?: CustomFont[];              // fuentes custom (CustomFont con dataURI)
  /** CSS `@font-face{...}` ya armado — vía `fontEmbed.collectActiveFontCss`. */
  fontCss?: string;
}

/**
 * Serializa el SVG, embebe fuentes custom y lo rasteriza en un canvas
 * del tamaño solicitado. Devuelve un Blob listo para descargar.
 */
export function svgToBlob(svgEl: SVGSVGElement, options: ExportOptions = {}): Promise<Blob> {
  const {
    format = 'jpeg',
    quality = 0.95,
    width = CANVAS.W,
    height = CANVAS.H,
    backgroundColor = BRAND.cream,
    fonts = [],
    fontCss = '',
  } = options;

  return new Promise((resolve, reject) => {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    injectFontFaces(clone, fonts, fontCss);

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('2d context unavailable'));
          return;
        }
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const q = format === 'jpeg' ? quality : undefined;
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('canvas.toBlob returned null'));
        }, mime, q);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image failed to load'));
    };
    img.src = url;
  });
}

/**
 * Trigger de descarga. No es puro (toca DOM) pero centraliza el patrón
 * para que los callers no dupliquen esta lógica.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  await new Promise((resolve) => setTimeout(resolve, 400));
  URL.revokeObjectURL(a.href);
}

function injectFontFaces(svg: SVGSVGElement, fonts: CustomFont[], fontCss: string): void {
  if (fonts.length === 0 && !fontCss) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  const customCss = fonts
    .map((f) => `@font-face{font-family:"${f.internalName}";src:url("${f.dataURI}") format("${f.format}");font-display:block;}`)
    .join('\n');
  style.textContent = [customCss, fontCss].filter(Boolean).join('\n\n');
  defs.appendChild(style);
  svg.insertBefore(defs, svg.firstChild);
}
