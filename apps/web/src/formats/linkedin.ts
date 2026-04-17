import type { SlideFormat } from '@/domain';

export const linkedinPost: SlideFormat = {
  id: 'linkedin-post',
  label: 'LinkedIn Post 1:1',
  width: 1200,
  height: 1200,
  safeMargins: { top: 100, right: 100, bottom: 100, left: 100 },
  grid: { columns: 12, gutter: 20, baseline: 8 },
};

export const linkedinCarousel: SlideFormat = {
  id: 'linkedin-carousel',
  label: 'LinkedIn Carousel 4:5',
  width: 1200,
  height: 1500,
  safeMargins: { top: 120, right: 120, bottom: 120, left: 120 },
  grid: { columns: 12, gutter: 20, baseline: 8 },
};
