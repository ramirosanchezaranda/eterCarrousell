import { BRAND, CANVAS, SAFE, SPACING } from '@/domain';
import { GridBackground, Logo, Star } from '../primitives';
import { pickDecor, wrapText } from '../helpers';
import type { SlideProps } from './types';

export function CoverSlide({ slide, layout: L, seed, index, assets }: SlideProps) {
  const { fonts } = assets;
  const decor = pickDecor(assets, index);
  const baseSize = 102 * L.textSize;
  const lineH = baseSize * 1.15;
  const lines = wrapText(slide.line1, L.textMaxChars);
  const logoY = CANVAS.H - SPACING.margin - 20;
  const counterColor = L.logoOnDark ? BRAND.cream : BRAND.ink;

  return (
    <>
      <GridBackground layout={L} decor={decor} seed={seed} />
      <g transform={`translate(${L.textX}, ${L.textY})`}>
        {lines.map((ln, i) => (
          <text
            key={i}
            x={0}
            y={i * lineH}
            textAnchor={L.textAlign}
            fontFamily={fonts.display}
            fontSize={baseSize}
            fontStyle="italic"
            fontWeight={600}
            fill={BRAND.blue}
            letterSpacing="-2.5"
          >
            {ln}
          </text>
        ))}
      </g>
      {L.textAlign === 'start' && (
        <Star cx={L.textX + 30} cy={L.textY + lines.length * lineH + SPACING.lg} size={38} color={BRAND.blue} />
      )}
      <Logo assets={assets} layout={L} y={logoY} />
      <g transform={`translate(${SAFE.right - 110}, ${SAFE.top + 12})`}>
        <text fontFamily={fonts.mono} fontSize={13} fill={counterColor} opacity={0.55} letterSpacing="2">
          DESLIZÁ →
        </text>
      </g>
    </>
  );
}
