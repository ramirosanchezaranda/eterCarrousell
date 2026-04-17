/**
 * Slot decorativo. Si hay imagen, la recorta al rect con clipPath.
 * Si no hay, renderiza una GlitchTexture procedural como fallback.
 */
import { GlitchTexture } from './GlitchTexture';

interface DecorSlotProps {
  src: string | null;
  seed: number;
  x: number;
  y: number;
  width: number;
  height: number;
  density?: number;
}

export function DecorSlot({ src, seed, x, y, width, height, density = 1 }: DecorSlotProps) {
  if (width <= 0 || height <= 0) return null;
  if (src) {
    const clipId = `dclip-${seed}-${Math.round(x)}-${Math.round(y)}`;
    return (
      <g>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <image href={src} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid slice" />
        </g>
      </g>
    );
  }
  return <GlitchTexture seed={seed} x={x} y={y} width={width} height={height} density={density} />;
}
