/**
 * Registry central de plantillas — combina familia "Classic" (las 10 originales
 * adaptadas al modelo de bloques en un paso posterior) y "Editorial" (10 nuevas,
 * 3 ya implementadas).
 *
 * El editor consume este registry para poblar el selector de plantilla agrupado
 * por familia.
 */
import type { TemplateFamily, TemplateMeta } from '@/domain';
import { EDITORIAL_TEMPLATES_META } from './editorial';
import { CLASSIC_TEMPLATES_META } from './classic';

export const ALL_TEMPLATES: TemplateMeta[] = [
  ...CLASSIC_TEMPLATES_META,
  ...EDITORIAL_TEMPLATES_META,
];

export function templatesByFamily(family: TemplateFamily): TemplateMeta[] {
  return ALL_TEMPLATES.filter((t) => t.family === family);
}

export function findTemplate(id: string): TemplateMeta | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}
