import type { BrandAssets, LegacyLayout, LegacySlide } from '@/domain';

/**
 * Props comunes a todos los slide components. El `layout` viene ya resuelto
 * por el caller (legacy `getLayout()` en paso 4; motor nuevo `solveLayout()`
 * a partir del paso 8 cuando el toggle `useNewEngine` esté activo).
 */
export interface SlideProps {
  slide: LegacySlide;
  layout: LegacyLayout;
  seed: number;
  index: number;
  total: number;
  assets: BrandAssets;
}
