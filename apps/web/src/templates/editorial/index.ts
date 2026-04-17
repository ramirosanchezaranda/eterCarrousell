/**
 * Familia "Editorial" — plantillas inspiradas en poster design chino moderno.
 * Estado: 3 implementadas (tiled, bleeding-design, color-blocks). Las 7 restantes
 * (only-one-picture, picture-splitting, image-crossover, misplaced-typesetting,
 * centered-picture, uniform-picture-size, creative-graphics) siguen el mismo
 * patrón: exponen un `TemplateMeta` con `initBlocks()` que devuelve los bloques
 * iniciales para un slideType + formato.
 */
import type { TemplateMeta } from '@/domain';
import { tiled } from './tiled';
import { bleedingDesign } from './bleeding-design';
import { colorBlocks } from './color-blocks';
import { onlyOnePicture } from './only-one-picture';
import { pictureSplitting } from './picture-splitting';
import { imageCrossover } from './image-crossover';
import { misplacedTypesetting } from './misplaced-typesetting';
import { centeredPicture } from './centered-picture';
import { uniformPictureSize } from './uniform-picture-size';
import { creativeGraphics } from './creative-graphics';

export const EDITORIAL_TEMPLATES_META: TemplateMeta[] = [
  tiled,
  bleedingDesign,
  colorBlocks,
  onlyOnePicture,
  pictureSplitting,
  imageCrossover,
  misplacedTypesetting,
  centeredPicture,
  uniformPictureSize,
  creativeGraphics,
];
