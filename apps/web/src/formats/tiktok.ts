import type { SlideFormat } from '@/domain';

/**
 * TikTok / Reels / YouTube Shorts — mismo canvas que Story pero con
 * safe zones más conservadoras por UI overlays más altos en TikTok.
 */
export const tiktokReels: SlideFormat = {
  id: 'tiktok-reels',
  label: 'TikTok / Reels 9:16',
  width: 1080,
  height: 1920,
  safeMargins: { top: 300, right: 120, bottom: 350, left: 120 },
  grid: { columns: 8, gutter: 16, baseline: 8 },
};
