/**
 * Fondo compartido por todas las slides: color base + decor + overlay + accent.
 */
import { BRAND, CANVAS } from '@/domain';
import type { LegacyLayout } from '@/domain';
import { DecorSlot } from './DecorSlot';

interface GridBackgroundProps {
  layout: LegacyLayout;
  decor: string | null;
  seed: number;
}

export function GridBackground({ layout, decor, seed }: GridBackgroundProps) {
  const baseColor = layout.bgBase === 'blue' ? BRAND.blue : BRAND.cream;
  return (
    <>
      <rect width={CANVAS.W} height={CANVAS.H} fill={baseColor} />
      <DecorSlot
        src={decor}
        seed={seed}
        x={layout.decorRect.x}
        y={layout.decorRect.y}
        width={layout.decorRect.w}
        height={layout.decorRect.h}
        density={layout.decorDensity}
      />
      {layout.overlay && (
        <rect width={CANVAS.W} height={CANVAS.H} fill={layout.overlay.color} opacity={layout.overlay.opacity} />
      )}
      {layout.accent && (
        <rect x={layout.accent.x} y={layout.accent.y} width={layout.accent.w} height={layout.accent.h} fill={BRAND.blue} />
      )}
    </>
  );
}
