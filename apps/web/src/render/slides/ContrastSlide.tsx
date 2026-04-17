import { BRAND, CANVAS, SPACING } from '@/domain';
import { GridBackground, Logo, SlideCounter, Star } from '../primitives';
import { pickDecor, wrapText } from '../helpers';
import type { SlideProps } from './types';

export function ContrastSlide({ slide, layout: L, seed, index, total, assets }: SlideProps) {
  const { fonts } = assets;
  const decor = pickDecor(assets, index);
  const baseSize = 78 * L.textSize;
  const lineH = baseSize * 1.15;
  const headlineLines = wrapText(slide.line1, L.textMaxChars);
  const subLines = wrapText((slide.line2 ?? '').toUpperCase(), 17);
  const logoY = CANVAS.H - SPACING.margin - 10;
  const counterColor = L.logoOnDark ? BRAND.cream : BRAND.ink;

  const subX = L.accent ? L.accent.x + SPACING.lg : L.textX;
  const subY = L.accent ? L.accent.y + SPACING.xl : L.textY + headlineLines.length * lineH + SPACING.lg;
  const subColor = L.accent ? BRAND.cream : BRAND.ink;

  return (
    <>
      <GridBackground layout={L} decor={decor} seed={seed} />
      <g transform={`translate(${L.textX}, ${L.textY})`}>
        {headlineLines.map((ln, i) => (
          <text
            key={i}
            x={0}
            y={i * lineH}
            textAnchor={L.textAlign}
            fontFamily={fonts.display}
            fontSize={baseSize}
            fontStyle="italic"
            fontWeight={500}
            fill={BRAND.blue}
            letterSpacing="-1.5"
          >
            {ln}
          </text>
        ))}
      </g>
      {L.textAlign === 'start' && (
        <Star cx={L.textX + 30} cy={L.textY + headlineLines.length * lineH + SPACING.lg} size={42} color={BRAND.blue} />
      )}
      <g transform={`translate(${subX}, ${subY})`}>
        {subLines.map((ln, i) => (
          <text
            key={i}
            x={0}
            y={i * 44}
            fontFamily={fonts.sans}
            fontSize={28}
            fontWeight={700}
            fill={subColor}
            letterSpacing="1"
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
