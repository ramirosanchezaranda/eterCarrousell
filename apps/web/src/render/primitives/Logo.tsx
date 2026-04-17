/**
 * Bloque de logo — si el usuario subió imagen la usa, si no cae al
 * fallback tipográfico `{eterCore}` + tagline.
 */
import { BRAND, CANVAS, SAFE } from '@/domain';
import type { BrandAssets, LegacyLayout } from '@/domain';

interface LogoProps {
  assets: BrandAssets;
  layout: LegacyLayout;
  y: number;
}

const LOGO_W = 200;
const LOGO_H = 70;

export function Logo({ assets, layout, y }: LogoProps) {
  const color = layout.logoOnDark ? BRAND.cream : BRAND.ink;

  const xText =
    layout.logoAlign === 'center' ? CANVAS.W / 2 - 110 :
    layout.logoAlign === 'right' ? SAFE.right - 220 :
    layout.logoX;

  const xImg =
    layout.logoAlign === 'center' ? CANVAS.W / 2 - LOGO_W / 2 :
    layout.logoAlign === 'right' ? SAFE.right - LOGO_W :
    layout.logoX;

  if (assets.logo) {
    return (
      <image
        href={assets.logo}
        x={xImg}
        y={y - LOGO_H}
        width={LOGO_W}
        height={LOGO_H}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  return (
    <g transform={`translate(${xText}, ${y})`}>
      <text fontFamily={assets.fonts.script} fontSize={68} fill={color} fontStyle="italic">
        {`{eterCore}`}
      </text>
      <text x={20} y={30} fontFamily={assets.fonts.sans} fontSize={13} fill={color} letterSpacing="3" opacity={0.85}>
        diseño web de vanguardia
      </text>
    </g>
  );
}
