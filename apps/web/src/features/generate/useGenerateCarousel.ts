/**
 * Hook que orquesta la generación. Pipeline anti-desvío en 4 etapas:
 *
 *   1. provider.generate(topic) → slides candidatas (puede tirar)
 *   2. planValidation → separa OK vs slots a reparar (contrato + anclaje al topic)
 *   3. si hay rotos: callRepair + mergeRepair (un intento)
 *   4. si todavía rotos: deterministicFallback (relleno local derivado del topic)
 *
 * Esto garantiza que el resultado final SIEMPRE tenga 6 slides bien formadas
 * y al menos cover+observation hablando del tema. Modelos chicos pueden seguir
 * desviándose, pero no rompen la UI ni dejan slides en blanco.
 */
import { useCallback, useState } from 'react';
import type { EditableSlide, SlideType, TemplateId } from '@/domain';
import { nanoid } from 'nanoid';
import { FORMATS } from '@/formats';
import { findTemplate } from '@/templates';
import {
  getProvider,
  planValidation,
  callRepair,
  mergeRepair,
  deterministicFallback,
} from '@/services/llm';
import { useProjectStore } from '@/state/projectStore';
import { useAssetsStore } from '@/state/assetsStore';
import { useProviderStore } from '@/state/providerStore';
import { placeholderForType } from '@/templates/init-helpers';
import { DEFAULT_SLIDE_ORDER, type GeneratedSlide } from '@carrousel/shared';

interface UseGenerateResult {
  loading: boolean;
  error: string | null;
  generate: (topic: string, templateId?: string) => Promise<void>;
  cancel: () => void;
}

const LANGUAGE: 'es' | 'en' = 'es';

export function useGenerateCarousel(): UseGenerateResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);
  const projectStore = useProjectStore();
  const assetsStore = useAssetsStore();
  const providerStore = useProviderStore();

  const cancel = useCallback(() => {
    abortCtrl?.abort();
    setAbortCtrl(null);
    setLoading(false);
  }, [abortCtrl]);

  const generate = useCallback(async (topic: string, overrideTemplateId?: string) => {
    const providerId = providerStore.activeProvider;
    const provider = getProvider(providerId);
    const config = providerStore.configs[providerId] ?? {};
    if (provider.requiresApiKey && !config.apiKey) {
      setError('Falta la API key en la tab "Generar".');
      return;
    }
    setError(null);
    setLoading(true);
    const ctrl = new AbortController();
    setAbortCtrl(ctrl);
    try {
      const input = { topic, count: DEFAULT_SLIDE_ORDER.length, language: LANGUAGE, signal: ctrl.signal };
      const candidates = await provider.generate(input, config);

      // Etapa 2: validar contrato + anclaje al topic.
      let plan = planValidation(candidates, topic, LANGUAGE);

      // Etapa 3: reparar selectivamente lo que falló.
      let merged: GeneratedSlide[] = [];
      let stillBroken: SlideType[] = plan.repair.map((s) => s.type);
      if (plan.repair.length === 0) {
        merged = plan.ok.map((s) => stripSlot(s));
        stillBroken = [];
      } else {
        try {
          const repaired = await callRepair(provider, providerId, config, input, plan.repair);
          const result = mergeRepair(plan, repaired, topic, LANGUAGE);
          merged = result.slides;
          stillBroken = result.stillBroken;
        } catch {
          // Si la reparación falla (red, rate limit, etc.), seguimos con
          // lo que tenemos válido + fallback.
          merged = plan.ok.map((s) => stripSlot(s));
          stillBroken = plan.repair.map((s) => s.type);
        }
      }

      // Etapa 4: rellenar lo que sigue roto con fallback determinístico.
      if (stillBroken.length > 0) {
        const finalSlides: GeneratedSlide[] = [];
        // Reconstruimos por slot, en orden DEFAULT_SLIDE_ORDER. `merged` ya
        // está ordenado por slot pero puede tener huecos — usamos el plan
        // reordenado para detectar cuál falta.
        const okBySlot = new Map<number, GeneratedSlide>();
        plan.ok.forEach((s) => okBySlot.set(s.slot, stripSlot(s)));
        // Slides que quedaron tras mergeRepair, mapeadas por type+orden:
        const replan = planValidation(merged, topic, LANGUAGE);
        replan.ok.forEach((s) => okBySlot.set(s.slot, stripSlot(s)));
        for (let slot = 0; slot < DEFAULT_SLIDE_ORDER.length; slot++) {
          const existing = okBySlot.get(slot);
          if (existing) {
            finalSlides.push(existing);
          } else {
            finalSlides.push(deterministicFallback(DEFAULT_SLIDE_ORDER[slot]!, topic, LANGUAGE));
          }
        }
        merged = finalSlides;
      }

      // Defensa final adicional: por más que el contrato esté pasado,
      // si por algún edge case la cover quedó sin line1, usamos el topic.
      const safeGenerated = ensureCoverTitle(merged, topic);
      projectStore.setTopic(topic);

      // Si el usuario ya tiene slides armadas, SOLO actualizamos los textos —
      // preservando fondo, decors, shapes, efectos, posiciones y z-order.
      // Si no hay slides (primera generación), creamos desde plantilla.
      if (projectStore.slides.length > 0) {
        const mergedOk = projectStore.mergeGeneratedTexts(safeGenerated);
        if (mergedOk) return;
      }
      const templateId = overrideTemplateId ?? projectStore.slides[0]?.templateId ?? 'tiled';
      const templateAssets = {
        logoSrc: assetsStore.logoDataURI,
        decorASrc: assetsStore.decorADataURI,
        decorBSrc: assetsStore.decorBDataURI,
      };
      applyGeneratedSlides(safeGenerated, templateId, assetsStore.theme, templateAssets);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message ?? 'Falló la generación');
    } finally {
      setLoading(false);
      setAbortCtrl(null);
    }
  }, [providerStore, projectStore, assetsStore]);

  return { loading, error, generate, cancel };
}

function stripSlot(s: GeneratedSlide & { slot?: number }): GeneratedSlide {
  const { slot: _slot, ...rest } = s as GeneratedSlide & { slot?: number };
  void _slot;
  return rest;
}

/**
 * Si el LLM devuelve una cover sin line1 utilizable, la reemplazamos
 * por el topic del usuario. Mejor un título imperfecto que una portada
 * vacía — ese era el bug reportado en los screenshots del usuario.
 */
function ensureCoverTitle(generated: GeneratedSlide[], topic: string): GeneratedSlide[] {
  if (generated.length === 0) return generated;
  const [first, ...rest] = generated;
  if (!first) return generated;
  const hasValidLine1 = typeof first.line1 === 'string' && first.line1.trim().length > 0;
  if (first.type === 'cover' && !hasValidLine1) {
    return [{ ...first, line1: topic.trim() }, ...rest];
  }
  return generated;
}

function applyGeneratedSlides(
  generated: GeneratedSlide[],
  templateId: string,
  theme: ReturnType<typeof useAssetsStore.getState>['theme'],
  templateAssets: { logoSrc?: string | null; decorASrc?: string | null; decorBSrc?: string | null },
): void {
  const project = useProjectStore.getState();
  const format = FORMATS[project.formatId];
  const meta = findTemplate(templateId);
  const seed = Math.floor(Math.random() * 99999);
  const slides: EditableSlide[] = generated.map((g, i) => {
    const type: SlideType = g.type;
    const baseBlocks = meta ? meta.initBlocks(type, format, theme, seed + i * 1000, templateAssets) : [];
    // Reemplaza preferentemente el primer kind='headline'. Si el template
    // no declara ese kind para este `type` (bug histórico: la cover perdía
    // su título), caemos al primer bloque de texto que no sea logo ni
    // counter — así garantizamos que el texto generado siempre aparece.
    let targetIdx = baseBlocks.findIndex((b) => b.content.kind === 'text' && b.kind === 'headline');
    if (targetIdx === -1) {
      targetIdx = baseBlocks.findIndex(
        (b) => b.content.kind === 'text' && b.kind !== 'logo' && b.kind !== 'counter',
      );
    }
    const blocks = baseBlocks.map((b, idx) => {
      if (idx !== targetIdx || b.content.kind !== 'text') return b;
      return { ...b, content: { ...b.content, text: g.line1 } };
    });
    return {
      id: nanoid(),
      type,
      templateId: (meta?.id ?? templateId) as TemplateId,
      blocks,
      seed: seed + i * 1000,
    };
  });
  // Fallback: si no había meta, al menos crear slides placeholder.
  const finalSlides = slides.length ? slides : generated.map((g) => makePlaceholderSlide(g));
  useProjectStore.setState({
    slides: finalSlides,
    currentSlideId: finalSlides[0]?.id ?? '',
    seed,
  });
}

function makePlaceholderSlide(g: GeneratedSlide): EditableSlide {
  const type = g.type;
  const ph = placeholderForType(type);
  return {
    id: nanoid(),
    type,
    templateId: 'editorial' as TemplateId,
    blocks: [],
    seed: 0,
  };
  // Nota: con blocks vacíos el usuario puede inicializar desde una plantilla después.
  void ph;
}
