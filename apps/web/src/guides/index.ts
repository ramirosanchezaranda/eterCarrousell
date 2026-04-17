/**
 * Registry de los 12 guides visuales. Cada guía expone líneas SVG para
 * renderizar como overlay en el editor, y snap points para que el drag
 * se pegue al punto fuerte más cercano cuando `snapEnabled`.
 *
 * Los guides NO se exportan al JPEG/PNG final — son solo ayudas editoriales.
 */
import type { EditorGuide, GuideId, SlideFormat, Vec2 } from '@/domain';
import { ruleOfThirds } from './rule-of-thirds';
import { ruleOfQuarters } from './rule-of-quarters';
import { goldenRatio } from './golden-ratio';
import { fibonacciSpiral } from './fibonacci-spiral';
import { diagonalA, diagonalB } from './diagonals';
import { modular3x4, modular4x6 } from './modular-grids';
import { axialSymmetry, centerCross, xSplit } from './symmetry';
import { customColumns } from './custom-columns';

export const GUIDES: Record<GuideId, EditorGuide> = {
  'rule-of-thirds': ruleOfThirds,
  'rule-of-quarters': ruleOfQuarters,
  'golden-ratio': goldenRatio,
  'fibonacci-spiral': fibonacciSpiral,
  'diagonal-a': diagonalA,
  'diagonal-b': diagonalB,
  'modular-3x4': modular3x4,
  'modular-4x6': modular4x6,
  'axial-symmetry': axialSymmetry,
  'center-cross': centerCross,
  'x-split': xSplit,
  'custom-columns': customColumns,
};

export const GUIDES_LIST: EditorGuide[] = Object.values(GUIDES);

/**
 * Encuentra el snap point más cercano a un punto dado entre todos los
 * guides activos. Devuelve null si ninguno está dentro del threshold.
 */
export function findNearestSnap(
  target: Vec2,
  activeGuideIds: GuideId[],
  format: SlideFormat,
  thresholdPx: number,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDist = thresholdPx;
  for (const id of activeGuideIds) {
    const guide = GUIDES[id];
    if (!guide) continue;
    const points = guide.snapPoints(format);
    for (const p of points) {
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
  }
  return best;
}
