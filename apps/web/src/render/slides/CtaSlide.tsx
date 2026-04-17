import { BRAND, CANVAS, SAFE, SPACING } from '@/domain';
import { GridBackground, Logo, SlideCounter } from '../primitives';
import { pickDecor, wrapText } from '../helpers';
import type { SlideProps } from './types';

export function CtaSlide({ slide, layout: L, seed, index, total, assets }: SlideProps) {
  const { fonts } = assets;
  const decor = pickDecor(assets, index);
  const baseSize = 88 * L.textSize;
  const lineH = baseSize * 1.15;
  const lines = wrapText(slide.line1, L.textMaxChars);
  const logoY = CANVAS.H - SPACING.margin - 20;
  const counterColor = L.logoOnDark ? BRAND.cream : BRAND.ink;
  const kickerX = L.textAlign === 'middle' ? L.textX - 40 : L.textX;
  const sub2X = L.textAlign === 'middle' ? L.textX - 120 : L.textX;
  const buttonX = L.textAlign === 'middle' ? L.textX - 140 : L.textX;

  return (
    <>
      <GridBackground layout={L} decor={decor} seed={seed} />
      <g transform={`translate(${kickerX}, ${SAFE.top + 80})`}>
        <line x1={0} y1={-8} x2={60} y2={-8} stroke={BRAND.blue} strokeWidth={2} />
        <text x={76} y={-1} fontFamily={fonts.mono} fontSize={13} fill={BRAND.blue} letterSpacing="3">
          PRÓXIMO PASO
        </text>
      </g>
      <g transform={`translate(${L.textX}, ${L.textY})`}>
        {lines.map((ln, i) => (
          <text
            key={i}
            y={i * lineH}
            textAnchor={L.textAlign}
            fontFamily={fonts.display}
            fontSize={baseSize}
            fontStyle="italic"
            fontWeight={600}
            fill={BRAND.blue}
            letterSpacing="-2"
          >
            {ln}
          </text>
        ))}
      </g>
      {slide.line2 && (
        <g transform={`translate(${sub2X}, ${L.textY + lines.length * lineH + SPACING.lg})`}>
          <text
            fontFamily={fonts.sans}
            fontSize={24}
            fontWeight={700}
            fill={L.logoOnDark ? BRAND.cream : BRAND.ink}
            letterSpacing="1.5"
          >
            {slide.line2.toUpperCase()}
          </text>
        </g>
      )}
      <g transform={`translate(${buttonX}, ${CANVAS.H - SPACING.margin - 260})`}>
        <rect width={280} height={72} fill={BRAND.blue} />
        <text x={140} y={47} textAnchor="middle" fontFamily={fonts.sans} fontSize={17} fontWeight={700} fill={BRAND.cream} letterSpacing="2.5">
          CONTACTANOS
        </text>
      </g>
      <Logo assets={assets} layout={L} y={logoY} />
      <SlideCounter index={index} total={total} color={counterColor} mono={fonts.mono} />
    </>
  );
}
