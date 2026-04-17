/**
 * Extracción de paleta dominante desde una imagen (dataURL o URL).
 * Usa `colorthief` (3 kB) para obtener el color dominante + N acentos.
 * Cache en memoria por `src` para evitar reprocesar la misma imagen.
 */
// @ts-expect-error colorthief carece de tipos default compatibles
import ColorThief from 'colorthief';
type RGB = [number, number, number];

const cache = new Map<string, string[]>();

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image load failed: ${src.slice(0, 40)}`));
    img.src = src;
  });
}

/** Extrae N colores dominantes como hex ordenados por prevalencia. */
export async function extractPalette(src: string, count = 5): Promise<string[]> {
  const cached = cache.get(src);
  if (cached && cached.length >= count) return cached.slice(0, count);
  const img = await loadImage(src);
  const thief = new ColorThief();
  try {
    const palette = (thief.getPalette(img, count) ?? []) as RGB[];
    const hex = palette.map((rgb: RGB) => rgbToHex(rgb[0], rgb[1], rgb[2]));
    cache.set(src, hex);
    return hex;
  } catch (err) {
    console.warn('palette extraction failed', err);
    return [];
  }
}

export function clearPaletteCache(): void {
  cache.clear();
}
