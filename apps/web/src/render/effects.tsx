/**
 * Genera un `<filter>` SVG para la lista de ImageEffects de un bloque.
 * Retorna el nodo `<filter id="...">` y el id para referenciar con
 * `filter="url(#id)"` en el image/rect.
 *
 * Soportados (via SVG filters puros + feImage data-URL donde hace falta):
 *   Color:     grayscale, sepia, invert, brightness, contrast, saturation,
 *              hue, duotone, gradient-map, overlay-color, threshold,
 *              posterize
 *   Blur:      blur (gaussiano), motion-blur (direccional), pixelate
 *              (blur + quantización)
 *   Sombra:    shadow (drop), inner-shadow, glow, bloom (glow cinemático
 *              con threshold + screen blend)
 *   Textura:   noise (grain masked al alpha), halftone (dots + luma blend),
 *              ascii (dither + threshold), scanlines (líneas CRT)
 *   Geom:      outline (contorno del alpha con morphology), emboss (relieve
 *              con convolución), sharpen (kernel laplaciano), chromatic
 *              (RGB split), vignette (radialGradient via feImage)
 *   Otros:     opacity (transparencia combinable con otros fx)
 *
 * Filter region: extendida a -50%..200% porque shadow/glow/motion-blur
 * necesitan espacio fuera del bbox original para no recortarse. Los
 * primitivos que usan feTurbulence declaran su propia subregion explícita
 * por el mismo motivo (bug histórico: franjas sin efecto arriba del bbox).
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
        // Halftone "print" aproximado: luminancia del source + patrón de
        // puntos generado con turbulence + blend multiply.
        //   1. Desaturamos el source para quedar con escala de grises.
        //   2. Generamos turbulencia tileable y la discretizamos a 2
        //      niveles duros → simula la malla de dots de una imprenta.
        //   3. feBlend multiply entre el pattern y la luminancia — zonas
        //      oscuras del source mantienen dots cerrados, zonas claras
        //      los "pierden".
        // No es halftone de imprenta real (eso requiere densidad variable
        // por región) pero es mucho mejor que el displacement anterior.
        const lumaId = `ht-l-${i}`;
        const noiseId = `ht-n-${i}`;
        const dotsId = `ht-d-${i}`;
        primitives.push(
          <feColorMatrix key={`${i}-l`} in={lastResult} type="matrix"
            values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"
            result={lumaId} />
        );
        primitives.push(
          <feTurbulence
            key={`${i}-t`}
            type="turbulence"
            baseFrequency={1 / Math.max(1, effect.size)}
            numOctaves={1}
            seed={3}
            x="-50%" y="-50%" width="200%" height="200%"
            result={noiseId}
          />
        );
        primitives.push(
          <feComponentTransfer key={`${i}-d`} in={noiseId} result={dotsId}>
            <feFuncR type="discrete" tableValues="0 0 1 1" />
            <feFuncG type="discrete" tableValues="0 0 1 1" />
            <feFuncB type="discrete" tableValues="0 0 1 1" />
          </feComponentTransfer>
        );
        primitives.push(
          <feBlend key={`${i}-b`} in={dotsId} in2={lumaId} mode="multiply" result={resultId} />
        );
        break;
      }
      case 'ascii': {
        // Look "dither / low-res" aproximando ASCII art. No podemos
        // renderizar texto desde un SVG filter, así que combinamos:
        //   1. desaturate source → escala de grises
        //   2. turbulencia fractional cuya frecuencia depende de `density`
        //      (más densidad = grano más fino → parece letras más chicas)
        //   3. feBlend multiply del ruido sobre la luma
        //   4. discretización dura a 2 niveles (negro/blanco) — da la
        //      estética de caracteres contrastantes sobre fondo
        const lumaId = `a-l-${i}`;
        const noiseId = `a-n-${i}`;
        const mixedId = `a-m-${i}`;
        primitives.push(
          <feColorMatrix key={`${i}-l`} in={lastResult} type="saturate" values="0" result={lumaId} />
        );
        primitives.push(
          <feTurbulence
            key={`${i}-t`}
            type="fractalNoise"
            baseFrequency={0.3 - effect.density * 0.25}
            numOctaves={1}
            seed={9}
            x="-50%" y="-50%" width="200%" height="200%"
            result={noiseId}
          />
        );
        primitives.push(
          <feBlend key={`${i}-b`} in={noiseId} in2={lumaId} mode="multiply" result={mixedId} />
        );
        primitives.push(
          <feComponentTransfer key={`${i}-d`} in={mixedId} result={resultId}>
            <feFuncR type="discrete" tableValues="0 1" />
            <feFuncG type="discrete" tableValues="0 1" />
            <feFuncB type="discrete" tableValues="0 1" />
          </feComponentTransfer>
        );
        break;
      }
      case 'opacity': {
        // Multiplica el alpha del canal por effect.value (0..1). Con 1 = sin
        // cambio; con 0 = invisible. Se aplica SOBRE el resultado de los
        // efectos anteriores, así podés combinarlo libremente.
        const v = Math.max(0, Math.min(1, effect.value));
        primitives.push(
          <feComponentTransfer key={i} in={lastResult} result={resultId}>
            <feFuncA type="linear" slope={v} intercept={0} />
          </feComponentTransfer>
        );
        break;
      }
      case 'shadow': {
        // Drop shadow: offset + blur del canal alpha, teñido con `color`,
        // y debajo del original. `opacity` atenúa el color de la sombra.
        const shadowBlur = `sh-blur-${i}`;
        const shadowOffset = `sh-off-${i}`;
        const shadowColor = `sh-col-${i}`;
        primitives.push(
          <feGaussianBlur key={`${i}-b`} in={lastResult} stdDeviation={Math.max(0, effect.blur)} result={shadowBlur} />
        );
        primitives.push(
          <feOffset key={`${i}-o`} in={shadowBlur} dx={effect.dx} dy={effect.dy} result={shadowOffset} />
        );
        primitives.push(
          <feFlood key={`${i}-f`} floodColor={effect.color} floodOpacity={effect.opacity} result={shadowColor} />
        );
        const shadowComposite = `sh-cmp-${i}`;
        primitives.push(
          <feComposite key={`${i}-c`} in={shadowColor} in2={shadowOffset} operator="in" result={shadowComposite} />
        );
        primitives.push(
          <feMerge key={`${i}-m`} result={resultId}>
            <feMergeNode in={shadowComposite} />
            <feMergeNode in={lastResult} />
          </feMerge>
        );
        break;
      }
      case 'glow': {
        // Mismo principio que shadow pero sin offset — blur del alpha teñido
        // y por debajo del contenido original.
        const glowBlur = `gl-blur-${i}`;
        const glowColor = `gl-col-${i}`;
        const glowComposite = `gl-cmp-${i}`;
        primitives.push(
          <feGaussianBlur key={`${i}-b`} in={lastResult} stdDeviation={Math.max(0, effect.radius)} result={glowBlur} />
        );
        primitives.push(
          <feFlood key={`${i}-f`} floodColor={effect.color} floodOpacity={effect.opacity} result={glowColor} />
        );
        primitives.push(
          <feComposite key={`${i}-c`} in={glowColor} in2={glowBlur} operator="in" result={glowComposite} />
        );
        primitives.push(
          <feMerge key={`${i}-m`} result={resultId}>
            <feMergeNode in={glowComposite} />
            <feMergeNode in={lastResult} />
          </feMerge>
        );
        break;
      }
      case 'noise': {
        // Grano: turbulence procedural enmascarado al alpha del source y
        // pintado encima. Usamos primitive subregions explícitos (-50%..200%)
        // en el feTurbulence porque su subregion por default puede quedarse
        // corta en algunos bbox — eso producía la franja sin grano arriba
        // de la imagen que reportó el usuario.
        const noiseTurb = `n-t-${i}`;
        const noiseGray = `n-g-${i}`;
        const noiseMasked = `n-m-${i}`;
        const baseFreq = 1 / Math.max(0.5, effect.scale);
        primitives.push(
          <feTurbulence
            key={`${i}-t`}
            type="fractalNoise"
            baseFrequency={baseFreq}
            numOctaves={2}
            seed={7}
            x="-50%" y="-50%" width="200%" height="200%"
            result={noiseTurb}
          />
        );
        // Convierte la turbulencia a gris con alpha = luminance * amount.
        // De esa forma el grano se ve como un overlay semitransparente y
        // no tapa el color del source (solo lo modula).
        primitives.push(
          <feColorMatrix
            key={`${i}-g`}
            in={noiseTurb}
            type="matrix"
            values={`0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  ${effect.amount} ${effect.amount} ${effect.amount} 0 0`}
            result={noiseGray}
          />
        );
        // Recorta el grano al alpha del source para que respete la forma
        // del bloque (no se derrame fuera).
        primitives.push(
          <feComposite
            key={`${i}-c`}
            in={noiseGray}
            in2={lastResult}
            operator="in"
            result={noiseMasked}
          />
        );
        // Pinta el source abajo y el grano arriba — sin multiply, que era
        // el que dejaba huecos donde la turbulencia era oscura.
        primitives.push(
          <feMerge key={`${i}-m`} result={resultId}>
            <feMergeNode in={lastResult} />
            <feMergeNode in={noiseMasked} />
          </feMerge>
        );
        break;
      }
      case 'vignette': {
        // Vignette REAL con `feImage` apuntando a un SVG inline con
        // `<radialGradient>`. SVG filters no tienen primitivas radiales
        // nativas, así que generamos un data-URL con el gradiente y lo
        // cargamos con feImage; luego feBlend en `multiply` oscurece los
        // bordes del source respetando el gradiente.
        //   - `spread`  = 0..1 controla dónde empieza a oscurecer (más
        //                  alto = vignette más ancha y sutil).
        //   - `intensity` = 0..1 qué tan oscuro llega en los bordes.
        const intensity = Math.max(0, Math.min(1, effect.intensity));
        const spread = Math.max(0, Math.min(1, effect.spread));
        const innerStop = (1 - spread) * 100; // % del radio donde arranca
        const vignetteSvg =
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
          `<defs><radialGradient id="g" cx="50%" cy="50%" r="75%">` +
          `<stop offset="${innerStop}%" stop-color="white" stop-opacity="1"/>` +
          `<stop offset="100%" stop-color="black" stop-opacity="${1 - intensity}"/>` +
          `</radialGradient></defs>` +
          `<rect width="100" height="100" fill="url(#g)"/></svg>`;
        const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(vignetteSvg)}`;
        const vigId = `vig-${i}`;
        primitives.push(
          <feImage
            key={`${i}-img`}
            href={dataUrl}
            // Data URLs no tienen CORS — garantizamos que el pattern cubra
            // todo el bbox del source via `preserveAspectRatio="none"`.
            preserveAspectRatio="none"
            x="0" y="0" width="100%" height="100%"
            result={vigId}
          />
        );
        primitives.push(
          <feBlend key={`${i}-b`} in={vigId} in2={lastResult} mode="multiply" result={resultId} />
        );
        break;
      }
      case 'posterize': {
        // Posterize: reduce niveles de color por canal a N bandas discretas.
        // Genera look "cartoon" o "screen print".
        const levels = Math.max(2, Math.min(8, Math.round(effect.levels)));
        const tableValues = Array.from({ length: levels }, (_, k) => (k / (levels - 1)).toFixed(3)).join(' ');
        primitives.push(
          <feComponentTransfer key={i} in={lastResult} result={resultId}>
            <feFuncR type="discrete" tableValues={tableValues} />
            <feFuncG type="discrete" tableValues={tableValues} />
            <feFuncB type="discrete" tableValues={tableValues} />
          </feComponentTransfer>
        );
        break;
      }
      case 'pixelate': {
        // "Low-res" aproximado: blur + posterización agresiva por canal.
        // Un pixelate de grid real necesita feFlood+feTile+feComposite o
        // canvas processing; este combo visualmente se lee como baja
        // resolución porque:
        //   1. blur funde detalles finos
        //   2. discrete cuantiza los colores a 4 niveles → look "indexed"
        const blurId = `px-b-${i}`;
        primitives.push(
          <feGaussianBlur key={`${i}-b`} in={lastResult} stdDeviation={Math.max(0.5, effect.size / 2)} result={blurId} />
        );
        primitives.push(
          <feComponentTransfer key={`${i}-d`} in={blurId} result={resultId}>
            <feFuncR type="discrete" tableValues="0 0.25 0.5 0.75 1" />
            <feFuncG type="discrete" tableValues="0 0.25 0.5 0.75 1" />
            <feFuncB type="discrete" tableValues="0 0.25 0.5 0.75 1" />
          </feComponentTransfer>
        );
        break;
      }
      case 'chromatic': {
        // RGB split: extrae canal R y lo desplaza a la izquierda, canal B
        // a la derecha, G al centro. Luego mergea todo. Look glitch / VHS.
        const off = effect.offset;
        const rChan = `ch-r-${i}`;
        const bChan = `ch-b-${i}`;
        const rOff = `ch-ro-${i}`;
        const bOff = `ch-bo-${i}`;
        primitives.push(
          <feColorMatrix key={`${i}-r`} in={lastResult} type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result={rChan} />
        );
        primitives.push(
          <feColorMatrix key={`${i}-b`} in={lastResult} type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result={bChan} />
        );
        primitives.push(
          <feOffset key={`${i}-or`} in={rChan} dx={-off} dy={0} result={rOff} />
        );
        primitives.push(
          <feOffset key={`${i}-ob`} in={bChan} dx={off}  dy={0} result={bOff} />
        );
        primitives.push(
          <feBlend key={`${i}-m1`} in={rOff} in2={lastResult} mode="screen" result={`ch-m1-${i}`} />
        );
        primitives.push(
          <feBlend key={`${i}-m2`} in={bOff} in2={`ch-m1-${i}`} mode="screen" result={resultId} />
        );
        break;
      }
      case 'scanlines': {
        // Líneas horizontales estilo monitor CRT. Generamos una textura
        // de gradiente vertical tileable con turbulence modulado por
        // componentTransfer a bandas; la multiplicamos por el source.
        const lines = `sl-l-${i}`;
        const tinted = `sl-t-${i}`;
        const baseFreq = 1 / Math.max(1, effect.gap * 2);
        primitives.push(
          <feTurbulence
            key={`${i}-t`}
            type="turbulence"
            baseFrequency={`0 ${baseFreq}`}
            numOctaves={1}
            seed={11}
            x="-50%" y="-50%" width="200%" height="200%"
            result={lines}
          />
        );
        // Discretiza a 2 niveles para que sean bandas duras.
        primitives.push(
          <feComponentTransfer key={`${i}-d`} in={lines} result={tinted}>
            <feFuncR type="discrete" tableValues="0 0 1 1" />
            <feFuncG type="discrete" tableValues="0 0 1 1" />
            <feFuncB type="discrete" tableValues="0 0 1 1" />
            <feFuncA type="linear" slope={effect.opacity} intercept={0} />
          </feComponentTransfer>
        );
        primitives.push(
          <feComposite key={`${i}-c`} in={tinted} in2={lastResult} operator="in" result={`sl-m-${i}`} />
        );
        primitives.push(
          <feMerge key={`${i}-m`} result={resultId}>
            <feMergeNode in={lastResult} />
            <feMergeNode in={`sl-m-${i}`} />
          </feMerge>
        );
        break;
      }
      case 'emboss': {
        // Relieve con feConvolveMatrix. Kernel clásico emboss 3×3; `strength`
        // multiplica la divergencia entre vecinos para un efecto más o menos
        // intenso.
        const s = effect.strength;
        const kernel = `${-s} ${-s} 0   ${-s} 1 ${s}   0 ${s} ${s}`;
        primitives.push(
          <feConvolveMatrix
            key={i}
            in={lastResult}
            order="3"
            kernelMatrix={kernel}
            divisor={1}
            bias={0.5}
            preserveAlpha="true"
            result={resultId}
          />
        );
        break;
      }
      case 'sharpen': {
        // Realce de bordes con kernel laplaciano escalado por strength.
        const s = effect.strength;
        const center = 1 + 4 * s;
        const kernel = `0 ${-s} 0  ${-s} ${center} ${-s}  0 ${-s} 0`;
        primitives.push(
          <feConvolveMatrix
            key={i}
            in={lastResult}
            order="3"
            kernelMatrix={kernel}
            divisor={1}
            preserveAlpha="true"
            result={resultId}
          />
        );
        break;
      }
      case 'overlay-color': {
        // Capa de color plano encima, masked por el alpha del source.
        // Útil para teñir texto o imágenes rápidamente sin tocar su color.
        const flood = `ov-f-${i}`;
        const masked = `ov-m-${i}`;
        primitives.push(
          <feFlood key={`${i}-f`} floodColor={effect.color} floodOpacity={effect.opacity} result={flood} />
        );
        primitives.push(
          <feComposite key={`${i}-c`} in={flood} in2={lastResult} operator="in" result={masked} />
        );
        primitives.push(
          <feMerge key={`${i}-m`} result={resultId}>
            <feMergeNode in={lastResult} />
            <feMergeNode in={masked} />
          </feMerge>
        );
        break;
      }
      case 'threshold': {
        // Binarización a blanco/negro: todo píxel con luminancia > level
        // se fuerza a blanco, el resto a negro. `level` va de 0 a 1.
        const L = Math.max(0, Math.min(1, effect.level));
        // Primero a gris luminancia, luego discrete con un único cut-off.
        const gray = `th-g-${i}`;
        primitives.push(
          <feColorMatrix key={`${i}-g`} in={lastResult} type="matrix"
            values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"
            result={gray} />
        );
        // feFuncX "discrete" con 2 valores — si t < L → 0, si t ≥ L → 1.
        // Generamos el tableValues con N=16 buckets para aproximar el umbral.
        const buckets = 16;
        const cut = Math.floor(L * buckets);
        const table = Array.from({ length: buckets }, (_, k) => (k < cut ? 0 : 1)).join(' ');
        primitives.push(
          <feComponentTransfer key={`${i}-d`} in={gray} result={resultId}>
            <feFuncR type="discrete" tableValues={table} />
            <feFuncG type="discrete" tableValues={table} />
            <feFuncB type="discrete" tableValues={table} />
          </feComponentTransfer>
        );
        break;
      }
      case 'inner-shadow': {
        // Sombra interna: invertimos el alpha del source, blurreamos y
        // offseteamos el alfa invertido, teñimos con color, y lo
        // compositamos DENTRO del source (operator=in).
        //   1. alphaInverted = 1 - SourceAlpha
        //   2. blur + offset sobre ese alpha
        //   3. teñir con el color
        //   4. composite-in con el source original para cortar fuera del shape
        //   5. merge debajo del source (source visible, shadow entra adentro)
        const invAlpha = `is-i-${i}`;
        const invBlurred = `is-b-${i}`;
        const invOffset = `is-o-${i}`;
        const floodColor = `is-c-${i}`;
        const tinted = `is-t-${i}`;
        const clipped = `is-k-${i}`;
        // Invierte alpha: feColorMatrix con alpha inverso (R/G/B en 0, A = 1-A)
        primitives.push(
          <feColorMatrix key={`${i}-i`} in={lastResult} type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1 1"
            result={invAlpha} />
        );
        primitives.push(
          <feGaussianBlur key={`${i}-b`} in={invAlpha} stdDeviation={Math.max(0, effect.blur)} result={invBlurred} />
        );
        primitives.push(
          <feOffset key={`${i}-o`} in={invBlurred} dx={effect.dx} dy={effect.dy} result={invOffset} />
        );
        primitives.push(
          <feFlood key={`${i}-f`} floodColor={effect.color} floodOpacity={effect.opacity} result={floodColor} />
        );
        primitives.push(
          <feComposite key={`${i}-t`} in={floodColor} in2={invOffset} operator="in" result={tinted} />
        );
        primitives.push(
          <feComposite key={`${i}-k`} in={tinted} in2={lastResult} operator="in" result={clipped} />
        );
        primitives.push(
          <feMerge key={`${i}-m`} result={resultId}>
            <feMergeNode in={lastResult} />
            <feMergeNode in={clipped} />
          </feMerge>
        );
        break;
      }
      case 'gradient-map': {
        // Mapea la luminancia del source a un gradiente de 3 colores:
        // dark → mid → light. Tipo filtro de Instagram / LUT 3-point.
        //   1. luminancia
        //   2. feComponentTransfer con tableValues por canal, interpolando
        //      entre los 3 colores en 3 stops (0 → 0.5 → 1)
        const d = hexToRgbNorm(effect.dark);
        const m = hexToRgbNorm(effect.mid);
        const l = hexToRgbNorm(effect.light);
        const lumaId = `gm-l-${i}`;
        primitives.push(
          <feColorMatrix key={`${i}-l`} in={lastResult} type="matrix"
            values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"
            result={lumaId} />
        );
        // tableValues con 3 puntos (dark, mid, light) por canal.
        // `feFuncX type="table"` interpola linealmente entre los valores.
        primitives.push(
          <feComponentTransfer key={`${i}-t`} in={lumaId} result={resultId}>
            <feFuncR type="table" tableValues={`${d.r} ${m.r} ${l.r}`} />
            <feFuncG type="table" tableValues={`${d.g} ${m.g} ${l.g}`} />
            <feFuncB type="table" tableValues={`${d.b} ${m.b} ${l.b}`} />
          </feComponentTransfer>
        );
        break;
      }
      case 'bloom': {
        // Bloom cinematográfico: extraer las zonas claras del source (por
        // encima de `threshold`), blurrearlas fuertemente y sumarlas
        // (screen blend) al source original. Da el característico "glow
        // de luces" de películas y videojuegos.
        const brightMask = `bl-bm-${i}`;
        const brightBlur = `bl-bb-${i}`;
        const intensified = `bl-int-${i}`;
        // 1. Extraer highlights: linear con slope alto e intercept negativo
        //    para que solo sobrevivan valores > threshold.
        const slope = 1 / Math.max(0.01, 1 - effect.threshold);
        const intercept = -effect.threshold * slope;
        primitives.push(
          <feComponentTransfer key={`${i}-m`} in={lastResult} result={brightMask}>
            <feFuncR type="linear" slope={slope} intercept={intercept} />
            <feFuncG type="linear" slope={slope} intercept={intercept} />
            <feFuncB type="linear" slope={slope} intercept={intercept} />
          </feComponentTransfer>
        );
        // 2. Blurrear los highlights para el halo.
        primitives.push(
          <feGaussianBlur key={`${i}-b`} in={brightMask} stdDeviation={Math.max(1, effect.radius)} result={brightBlur} />
        );
        // 3. Multiplicar por la intensidad deseada.
        primitives.push(
          <feComponentTransfer key={`${i}-i`} in={brightBlur} result={intensified}>
            <feFuncR type="linear" slope={effect.intensity} intercept={0} />
            <feFuncG type="linear" slope={effect.intensity} intercept={0} />
            <feFuncB type="linear" slope={effect.intensity} intercept={0} />
          </feComponentTransfer>
        );
        // 4. Screen blend con el source para sumar luz (no simple merge).
        primitives.push(
          <feBlend key={`${i}-s`} in={intensified} in2={lastResult} mode="screen" result={resultId} />
        );
        break;
      }
      case 'outline': {
        // Contorno del alpha: expandimos el SourceAlpha con feMorphology
        // dilate, restamos el alpha original → queda el "ring" exterior.
        // Teñimos con color y mergeamos debajo del source.
        const w = Math.max(0.5, effect.width);
        const dilated = `ol-d-${i}`;
        const ring = `ol-r-${i}`;
        const floodC = `ol-f-${i}`;
        const tintedR = `ol-t-${i}`;
        primitives.push(
          <feMorphology key={`${i}-d`} in="SourceAlpha" operator="dilate" radius={w} result={dilated} />
        );
        // ring = dilated - SourceAlpha (arithmetic: k2=1, k3=-1)
        primitives.push(
          <feComposite
            key={`${i}-r`}
            in={dilated}
            in2="SourceAlpha"
            operator="arithmetic"
            k1={0} k2={1} k3={-1} k4={0}
            result={ring}
          />
        );
        primitives.push(
          <feFlood key={`${i}-f`} floodColor={effect.color} floodOpacity={1} result={floodC} />
        );
        primitives.push(
          <feComposite key={`${i}-t`} in={floodC} in2={ring} operator="in" result={tintedR} />
        );
        // Outline debajo del source para que el ring rodee sin tapar contenido.
        primitives.push(
          <feMerge key={`${i}-m`} result={resultId}>
            <feMergeNode in={tintedR} />
            <feMergeNode in={lastResult} />
          </feMerge>
        );
        break;
      }
      case 'motion-blur': {
        // Blur direccional: descompone `strength` en componentes X/Y según
        // el ángulo. feGaussianBlur soporta stdDeviation asimétrico pero
        // solo horizontal/vertical — para diagonales mejor resultado se
        // obtiene con varios pasos, acá usamos la descomposición simple.
        const rad = (effect.angle * Math.PI) / 180;
        const sx = Math.abs(effect.strength * Math.cos(rad));
        const sy = Math.abs(effect.strength * Math.sin(rad));
        primitives.push(
          <feGaussianBlur
            key={i}
            in={lastResult}
            stdDeviation={`${sx.toFixed(2)} ${sy.toFixed(2)}`}
            result={resultId}
          />
        );
        break;
      }
    }
    lastResult = resultId;
  });

  return {
    id,
    node: (
      <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
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
