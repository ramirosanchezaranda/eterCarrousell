import type { SlideFormat } from '@/domain';

export const instagram1x1: SlideFormat = {
  id: 'ig-1x1',
  label: 'Instagram Post 1:1',
  width: 1080,
  height: 1080,
  safeMargins: { top: 96, right: 96, bottom: 96, left: 96 },
  grid: { columns: 12, gutter: 16, baseline: 8 },
};

export const instagram4x5: SlideFormat = {
  id: 'ig-4x5',
  label: 'Instagram Post 4:5',
  width: 1080,
  height: 1350,
  safeMargins: { top: 120, right: 120, bottom: 120, left: 120 },
  grid: { columns: 12, gutter: 16, baseline: 8 },
};
