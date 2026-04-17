/**
 * Genera un `<filter>` SVG para la lista de ImageEffects de un bloque.
 * Retorna el nodo `<filter id="...">` y el id para referenciar con
 * `filter="url(#id)"` en el image/rect.
 *
 * Soportados (via SVG filters puros, sin dependencias):
 *   - grayscale, sepia, invert
 *   - blur
 *   - brightness, contrast, saturation, hue
 *   - duotone (2 colores)
 *   - halftone (aproximado con feTurbulence)
 *
 * `ascii` queda como TODO (requiere canvas processing previo).
 */
import type { ImageEffect } from '@/domain';

export interface FilterChain {
  id: string;
  node: JSX.Element;
}

export function buildFilterChain(blockId: string, effects: ImageEffect[] | undefined): FilterChain | null {
  if (!effects || effects.length === 0) return null;
  const id = `fx-${blockId}`;
  const primitives: JSX.Element[] = [];
  let lastResult = 'SourceGraphic';

  effects.forEach((effect, i) => {
    const resultId = `r${i}`;
    switch (effect.kind) {
      case 'grayscale':
        primitives.push(
          <feColorMatrix key={i} in={lastResult} type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
            result={resultId} />
        );
        break;
      case 'sepia':
        primitives.push(
          <feColorMatrix key={i} in={lastResult} type="matrix"
            values=".393 .769 .189 0 0  .349 .686 .168 0 0  .272 .534 .131 0 0  0 0 0 1 0"
            result={resultId} />
        );
        break;
      case 'invert':
        primitives.push(
          <feColorMatrix key={i} in={lastResult} type="matrix"
            values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"
            result={resultId} />
        );
        break;
      case 'blur':
        primitives.push(
          <feGaussianBlur key={i} in={lastResult} stdDeviation={Math.max(0, effect.radius)} result={resultId} />
        );
        break;
      case 'brightness':
        primitives.push(
          <feComponentTransfer key={i} in={lastResult} result={resultId}>
            <feFuncR type="linear" slope={1} intercept={effect.value} />
            <feFuncG type="linear" slope={1} intercept={effect.value} />
            <feFuncB type="linear" slope={1} intercept={effect.value} />
          </feComponentTransfer>
        );
        break;
      case 'contrast': {
        const s = effect.value;
        const b = -(0.5 * s) + 0.5;
        primitives.push(
          <feComponentTransfer key={i} in={lastResult} result={resultId}>
            <feFuncR type="linear" slope={s} intercept={b} />
            <feFuncG type="linear" slope={s} intercept={b} />
            <feFuncB type="linear" slope={s} intercept={b} />
          </feComponentTransfer>
        );
        break;
      }
      case 'saturation':
        primitives.push(
          <feColorMatrix key={i} in={lastResult} type="saturate" values={String(effect.value)} result={resultId} />
        );
        break;
      case 'hue':
        primitives.push(
          <feColorMatrix key={i} in={lastResult} type="hueRotate" values={String(effect.deg)} result={resultId} />
        );
        break;
      case 'duotone': {
        // Step 1: desaturate; Step 2: component transfer por canal mapeando a 2 colores
        const darkRGB = hexToRgbNorm(effect.dark);
        const lightRGB = hexToRgbNorm(effect.light);
        const grayId = `gray${i}`;
        primitives.push(
          <feColorMatrix key={`${i}-g`} in={lastResult} type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
            result={grayId} />
        );
        primitives.push(
          <feComponentTransfer key={`${i}-d`} in={grayId} result={resultId}>
            <feFuncR type="table" tableValues={`${darkRGB.r} ${lightRGB.r}`} />
            <feFuncG type="table" tableValues={`${darkRGB.g} ${lightRGB.g}`} />
            <feFuncB type="table" tableValues={`${darkRGB.b} ${lightRGB.b}`} />
          </feComponentTransfer>
        );
        break;
      }
      case 'halftone': {
        // Aproximación: turbulence + displace → puntos
        const seed = 3;
        const tId = `t${i}`;
        primitives.push(
          <feTurbulence key={`${i}-t`} type="fractalNoise" baseFrequency={1 / Math.max(effect.size, 2)} numOctaves={1} seed={seed} result={tId} />
        );
        primitives.push(
          <feDisplacementMap key={`${i}-d`} in={lastResult} in2={tId} scale={effect.size * 0.5} result={resultId} />
        );
        break;
      }
      case 'ascii':
        // TODO real: requiere canvas processing. Por ahora aproximamos con halftone + posterize
        primitives.push(
          <feComponentTransfer key={`${i}-p`} in={lastResult} result={resultId}>
            <feFuncR type="discrete" tableValues="0 .25 .5 .75 1" />
            <feFuncG type="discrete" tableValues="0 .25 .5 .75 1" />
            <feFuncB type="discrete" tableValues="0 .25 .5 .75 1" />
          </feComponentTransfer>
        );
        break;
    }
    lastResult = resultId;
  });

  return {
    id,
    node: (
      <filter id={id} x="0" y="0" width="100%" height="100%">
        {primitives}
      </filter>
    ),
  };
}

function hexToRgbNorm(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}
