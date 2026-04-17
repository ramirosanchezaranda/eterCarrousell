import { BRAND, CANVAS, SPACING } from '@/domain';
import { GridBackground, Logo, SlideCounter } from '../primitives';
import { pickDecor, wrapText } from '../helpers';
import type { SlideProps } from './types';

export function QuoteSlide({ slide, layout: L, seed, index, total, assets }: SlideProps) {
  const { fonts } = assets;
  const decor = pickDecor(assets, index);
  const baseSize = 66 * L.textSize;
  const lineH = baseSize * 1.2;
  const lines = wrapText(slide.line1, L.textMaxChars + 3);
  const logoY = CANVAS.H - SPACING.margin - 20;
  const quoteX = L.textAlign === 'middle' ? L.textX - 30 : L.textX;

  return (
    <>
      <GridBackground layout={L} decor={decor} seed={seed} />
      <g transform={`translate(${quoteX}, ${L.textY - 40})`}>
        <text fontFamily={fonts.display} fontSize={160} fill={BRAND.cream} fontStyle="italic" opacity={0.25}>
          &quot;
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
            fill={BRAND.cream}
            letterSpacing="-1"
          >
            {ln}
          </text>
        ))}
      </g>
      <Logo assets={assets} layout={L} y={logoY} />
      <SlideCounter index={index} total={total} color={BRAND.cream} mono={fonts.mono} />
    </>
  );
}
