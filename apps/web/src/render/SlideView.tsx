/**
 * Dispatcher SVG: recibe una slide + su `LegacyLayout` resuelto y delega
 * a la componente correspondiente según el `slide.type`. El caller decide
 * el tamaño del viewBox (default 1080×1350 del legacy; multi-formato en paso 7+).
 */
import { CANVAS } from '@/domain';
import type { BrandAssets, LegacyLayout, LegacySlide } from '@/domain';
import {
  CoverSlide, ContrastSlide, ObservationSlide, QuoteSlide, StatSlide, CtaSlide,
} from './slides';

interface SlideViewProps {
  slide: LegacySlide;
  layout: LegacyLayout;
  seed: number;
  index: number;
  total: number;
  assets: BrandAssets;
  width?: number;
  height?: number;
}

export function SlideView({
  slide, layout, seed, index, total, assets,
  width = CANVAS.W, height = CANVAS.H,
}: SlideViewProps) {
  const common = { slide, layout, seed, index, total, assets };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {slide.type === 'cover' && <CoverSlide {...common} />}
      {slide.type === 'contrast' && <ContrastSlide {...common} />}
      {slide.type === 'observation' && <ObservationSlide {...common} />}
      {slide.type === 'quote' && <QuoteSlide {...common} />}
      {slide.type === 'stat' && <StatSlide {...common} />}
      {slide.type === 'cta' && <CtaSlide {...common} />}
    </svg>
  );
}
