import { BRAND, CANVAS, SPACING } from '@/domain';
import { GridBackground, Logo, SlideCounter } from '../primitives';
import { pickDecor, wrapText } from '../helpers';
import type { SlideProps } from './types';

export function StatSlide({ slide, layout: L, seed, index, total, assets }: SlideProps) {
  const { fonts } = assets;
  const decor = pickDecor(assets, index);
  const numberSize = 260 * L.textSize;
  const captionSize = 42 * L.textSize;
  const captionLines = wrapText(slide.line1 ?? '', L.textMaxChars + 4);
  const captionLineH = captionSize * 1.3;
  const logoY = CANVAS.H - SPACING.margin - 20;
  const counterColor = L.logoOnDark ? BRAND.cream : BRAND.ink;
  const numberY = L.textY + numberSize * 0.7;
  const captionY = numberY + SPACING.md;

  return (
    <>
      <GridBackground layout={L} decor={decor} seed={seed} />
      <g transform={`translate(${L.textX}, ${numberY})`}>
        <text
          textAnchor={L.textAlign}
          fontFamily={fonts.display}
          fontSize={numberSize}
          fontWeight={600}
          fill={BRAND.blue}
          letterSpacing="-8"
          fontStyle="italic"
        >
          {slide.number ?? '—'}
        </text>
      </g>
      <g transform={`translate(${L.textX}, ${captionY})`}>
        {captionLines.map((ln, i) => (
          <text
            key={i}
            y={i * captionLineH}
            textAnchor={L.textAlign}
            fontFamily={fonts.display}
            fontSize={captionSize}
            fontStyle="italic"
            fill={L.logoOnDark ? BRAND.cream : BRAND.ink}
            letterSpacing="-0.5"
          >
            {ln}
          </text>
        ))}
      </g>
      {slide.caption && (
        <g transform={`translate(${L.textAlign === 'middle' ? L.textX - 80 : L.textX}, ${captionY + captionLines.length * captionLineH + SPACING.lg})`}>
          <line x1={0} y1={-8} x2={40} y2={-8} stroke={L.logoOnDark ? BRAND.cream : BRAND.ink} strokeWidth={1.5} opacity={0.4} />
          <text x={56} y={-1} fontFamily={fonts.mono} fontSize={15} fill={L.logoOnDark ? BRAND.cream : BRAND.ink} opacity={0.5} letterSpacing="2.5">
            {slide.caption.toUpperCase()}
          </text>
        </g>
      )}
      <Logo assets={assets} layout={L} y={logoY} />
      <SlideCounter index={index} total={total} color={counterColor} mono={fonts.mono} />
    </>
  );
}
