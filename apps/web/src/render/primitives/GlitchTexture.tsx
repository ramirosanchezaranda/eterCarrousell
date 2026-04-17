/**
 * Textura procedural de "glitch" en SVG. Genera barras verticales con
 * intensidades aleatorias deterministas por seed. Usada como fallback
 * cuando no hay imagen decor.
 */
import { useMemo } from 'react';
import { BRAND } from '@/domain';
import { seededRandom } from '../helpers';

interface GlitchTextureProps {
  seed: number;
  x: number;
  y: number;
  width: number;
  height: number;
  density?: number;
}

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
}

export function GlitchTexture({ seed, x, y, width, height, density = 0.35 }: GlitchTextureProps) {
  const bars = useMemo<Bar[]>(() => {
    const rand = seededRandom(seed);
    const out: Bar[] = [];
    // Cap de densidad para que plantillas con density=1 también sean eficientes.
    const effective = Math.min(density, 0.5);
    const cols = Math.max(20, Math.floor(180 * effective));
    const colW = width / cols;
    for (let c = 0; c < cols; c++) {
      const intensity = rand();
      // Menos segmentos por columna (antes 20-60) — mantiene la textura pero
      // reduce el total de rects a la mitad.
      const segments = 10 + Math.floor(rand() * 18);
      let cy = 0;
      for (let s = 0; s < segments && cy < height; s++) {
        const h = 4 + rand() * 30;
        const pick = rand();
        let color: string = BRAND.ink;
        if (pick > 0.35 && pick < 0.7) color = BRAND.blueDark;
        else if (pick >= 0.7 && pick < 0.92) color = BRAND.blue;
        else if (pick >= 0.92) color = BRAND.blueLight;
        out.push({ x: c * colW, y: cy, w: colW + 0.5, h, color, opacity: 0.4 + intensity * 0.6 });
        cy += h;
      }
    }
    // Streaks horizontales decorativas: de 40 a 15 — el ojo no distingue a
    // resoluciones de preview y recorta ~25 rects por decor.
    for (let i = 0; i < 15; i++) {
      const cy = rand() * height;
      const h = 2 + rand() * 8;
      const w = 60 + rand() * 300;
      const cx = rand() * (width - w);
      out.push({ x: cx, y: cy, w, h, color: BRAND.cream, opacity: 0.15 + rand() * 0.3 });
    }
    return out;
  }, [seed, width, height, density]);

  const clipId = `clip-${seed}-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g>
      <clipPath id={clipId}>
        <rect x={x} y={y} width={width} height={height} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x={x} y={y} width={width} height={height} fill={BRAND.blue} />
        {bars.map((b, i) => (
          <rect key={i} x={x + b.x} y={y + b.y} width={b.w} height={b.h} fill={b.color} opacity={b.opacity} />
        ))}
      </g>
    </g>
  );
}
