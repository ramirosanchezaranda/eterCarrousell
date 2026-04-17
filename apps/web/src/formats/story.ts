import type { SlideFormat } from '@/domain';

export const story: SlideFormat = {
  id: 'ig-story',
  label: 'Story / Reel / Shorts 9:16',
  width: 1080,
  height: 1920,
  safeMargins: { top: 250, right: 80, bottom: 250, left: 80 },
  grid: { columns: 8, gutter: 16, baseline: 8 },
};
