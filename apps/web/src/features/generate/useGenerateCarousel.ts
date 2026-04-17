/**
 * Hook que resuelve el provider activo, llama a `generate()`, aplica las
 * slides generadas al proyecto inicializando bloques con la plantilla actual.
 */
import { useCallback, useState } from 'react';
import type { EditableSlide, SlideType, TemplateId } from '@/domain';
import { nanoid } from 'nanoid';
import { FORMATS } from '@/formats';
import { findTemplate } from '@/templates';
import { getProvider } from '@/services/llm';
import { useProjectStore } from '@/state/projectStore';
import { useAssetsStore } from '@/state/assetsStore';
import { useProviderStore } from '@/state/providerStore';
import { placeholderForType } from '@/templates/init-helpers';
import type { GeneratedSlide } from '@carrousel/shared';

interface UseGenerateResult {
  loading: boolean;
  error: string | null;
  generate: (topic: string, templateId?: string) => Promise<void>;
  cancel: () => void;
}

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
      const generated = await provider.generate(
        { topic, count: 6, language: 'es', signal: ctrl.signal },
        config,
      );
      projectStore.setTopic(topic);
      // Si el usuario ya tiene slides armadas, SOLO actualizamos los textos —
      // preservando fondo, decors, shapes, efectos, posiciones y z-order.
      // Si no hay slides (primera generación), creamos desde plantilla.
      if (projectStore.slides.length > 0) {
        const merged = projectStore.mergeGeneratedTexts(generated);
        if (merged) return;
      }
      const templateId = overrideTemplateId ?? projectStore.slides[0]?.templateId ?? 'tiled';
      const templateAssets = {
        logoSrc: assetsStore.logoDataURI,
        decorASrc: assetsStore.decorADataURI,
        decorBSrc: assetsStore.decorBDataURI,
      };
      applyGeneratedSlides(generated, templateId, assetsStore.theme, templateAssets);
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
    // Reemplaza el primer text/headline block con el texto generado.
    const headlineIdx = baseBlocks.findIndex((b) => b.content.kind === 'text' && b.kind === 'headline');
    const blocks = baseBlocks.map((b, idx) => {
      if (idx !== headlineIdx || b.content.kind !== 'text') return b;
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
