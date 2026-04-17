import type { FormatId, SlideFormat } from '@/domain';
import { instagram1x1, instagram4x5 } from './instagram';
import { story } from './story';
import { linkedinPost, linkedinCarousel } from './linkedin';
import { tiktokReels } from './tiktok';

export const FORMATS: Record<FormatId, SlideFormat> = {
  'ig-1x1': instagram1x1,
  'ig-4x5': instagram4x5,
  'ig-story': story,
  'linkedin-post': linkedinPost,
  'linkedin-carousel': linkedinCarousel,
  'tiktok-reels': tiktokReels,
};

export const FORMATS_LIST: SlideFormat[] = Object.values(FORMATS);

export const DEFAULT_FORMAT_ID: FormatId = 'ig-4x5';

/** Factor de escala proporcional relativo al formato de referencia (4:5). */
export function formatScale(format: SlideFormat): number {
  const ref = FORMATS['ig-4x5'];
  return Math.min(format.width / ref.width, format.height / ref.height);
}
