/**
 * Cliente del BFF. Si `VITE_USE_BFF` está activado pega a `/api/generate`
 * (resuelto por el proxy de Vite). Si no, cae al fallback local (el mismo
 * fetch directo a Anthropic que hacía el legacy, expuesto aquí para no
 * duplicar en la UI — en prod real esta ruta debería estar off).
 */
import type { LegacySlide } from '@/domain';

const USE_BFF = import.meta.env.VITE_USE_BFF === 'true';

export interface GenerateOptions {
  topic: string;
  count?: number;
  language?: 'es' | 'en';
  signal?: AbortSignal;
}

export async function generateCarousel({ topic, count = 6, language = 'es', signal }: GenerateOptions): Promise<LegacySlide[]> {
  if (USE_BFF) {
    const resp = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, count, language }),
      signal,
    });
    if (!resp.ok) throw new Error(`BFF error ${resp.status}`);
    const { slides } = await resp.json() as { slides: LegacySlide[] };
    return slides;
  }
  // Fallback legacy — solo para desarrollo cuando no hay BFF. No usar en prod.
  throw new Error('VITE_USE_BFF=false — configure BFF o habilite fallback local');
}
