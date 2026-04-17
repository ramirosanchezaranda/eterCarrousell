import { BRAND, CANVAS, SAFE, SPACING } from '@/domain';
import { GridBackground, Logo, SlideCounter } from '../primitives';
import { pickDecor, wrapText } from '../helpers';
import type { SlideProps } from './types';

export function ObservationSlide({ slide, layout: L, seed, index, total, assets }: SlideProps) {
  const { fonts } = assets;
  const decor = pickDecor(assets, index);
  const baseSize = 54 * L.textSize;
  const lineH = baseSize * 1.25;
  const lines = wrapText(slide.line1, L.textMaxChars + 4);
  const logoY = CANVAS.H - SPACING.margin - 20;
  const counterColor = L.logoOnDark ? BRAND.cream : BRAND.ink;
  const kickerX = L.textAlign === 'middle' ? L.textX - 40 : L.textX;

  return (
    <>
      <GridBackground layout={L} decor={decor} seed={seed} />
      <g transform={`translate(${kickerX}, ${SAFE.top + 60})`}>
        <line x1={0} y1={-8} x2={60} y2={-8} stroke={BRAND.blue} strokeWidth={2} />
        <text x={76} y={-1} fontFamily={fonts.mono} fontSize={13} fill={BRAND.blue} letterSpacing="3">
          OBSERVACIÓN
        </text>
      </g>
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
            fontWeight={500}
            fill={L.logoOnDark ? BRAND.cream : BRAND.ink}
            letterSpacing="-0.5"
          >
            {ln}
          </text>
        ))}
      </g>
      <Logo assets={assets} layout={L} y={logoY} />
      <SlideCounter index={index} total={total} color={counterColor} mono={fonts.mono} />
    </>
  );
}
