/**
 * @carrousel/shared — schemas y utilidades compartidas entre frontend (apps/web)
 * y BFF (apps/bff). Validan input/output de /api/generate.
 */
import { z } from 'zod';

export const SHARED_VERSION = '0.3.0' as const;

export const SlideTypeSchema = z.enum(['cover', 'contrast', 'observation', 'quote', 'stat', 'cta']);

export const GeneratedSlideSchema = z.object({
  type: SlideTypeSchema,
  line1: z.string().min(1),
  line2: z.string().optional(),
  number: z.string().optional(),
  caption: z.string().optional(),
});

export const GenerateRequestSchema = z.object({
  topic: z.string().min(3).max(500),
  count: z.number().int().min(3).max(10).default(6),
  language: z.enum(['es', 'en']).default('es'),
});

export const GenerateResponseSchema = z.object({
  slides: z.array(GeneratedSlideSchema).min(1),
});

export type GeneratedSlide = z.infer<typeof GeneratedSlideSchema>;
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
