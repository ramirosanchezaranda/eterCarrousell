/**
 * Carga y manejo de fuentes personalizadas (ttf/otf/woff/woff2).
 * Registra la fuente en `document.fonts` para que SVG la renderice,
 * y guarda el dataURI para embeberlo en el export.
 */
import type { CustomFont, FontRole } from '@/domain';

interface FontFormatInfo {
  mime: string;
  format: string;
}

const FORMAT_MAP: Record<string, FontFormatInfo> = {
  ttf: { mime: 'font/ttf', format: 'truetype' },
  otf: { mime: 'font/otf', format: 'opentype' },
  woff: { mime: 'font/woff', format: 'woff' },
  woff2: { mime: 'font/woff2', format: 'woff2' },
};

const DEFAULT_FORMAT: FontFormatInfo = { mime: 'font/ttf', format: 'truetype' };

export function getFontFormat(filename: string): FontFormatInfo {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return FORMAT_MAP[ext] ?? DEFAULT_FORMAT;
}

export async function fileToDataURI(file: File, mime: string): Promise<string> {
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Carga una fuente desde un File y la registra en document.fonts.
 * El `slotName` determina el rol (display/sans/script/mono).
 */
export async function loadCustomFont(file: File, slotName: string): Promise<CustomFont> {
  const { mime, format } = getFontFormat(file.name);
  const dataURI = await fileToDataURI(file, mime);
  const internalName = `${slotName}-${Date.now()}`;
  const fontFace = new FontFace(internalName, `url(${dataURI})`);
  await fontFace.load();
  document.fonts.add(fontFace);

  const role = inferRole(slotName);
  return { internalName, fileName: file.name, dataURI, format, fontFace, role };
}

export function unloadCustomFont(font: CustomFont): void {
  try {
    document.fonts.delete(font.fontFace);
  } catch {
    // noop — si falla el unregister no es crítico
  }
}

function inferRole(slotName: string): FontRole {
  const lower = slotName.toLowerCase();
  if (lower.includes('sans')) return 'sans';
  if (lower.includes('script')) return 'script';
  if (lower.includes('mono')) return 'mono';
  return 'display';
}
