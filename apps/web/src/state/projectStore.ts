/**
 * Store central del proyecto: carrusel activo, slides como EditableSlide[]
 * (bloques posicionables), formato actual y topic. Con undo/redo via zundo.
 */
import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createDebouncedLocalStorage } from './debouncedStorage';
import { nanoid } from 'nanoid';
import type {
  EditableSlide, FormatId, PositionedBlock, SlideType, TemplateId, BrandTheme, SlideFormat, TemplateAssets, SlideBackground,
} from '@/domain';
import { FORMATS } from '@/formats';
import { findTemplate } from '@/templates';

export interface ProjectState {
  topic: string;
  formatId: FormatId;
  themeId: string;
  slides: EditableSlide[];
  currentSlideId: string;
  seed: number;
}

export interface ProjectActions {
  setTopic: (topic: string) => void;
  setFormatId: (id: FormatId) => void;
  setCurrentSlideId: (id: string) => void;
  addSlide: (type: SlideType, templateId: TemplateId | string, theme: BrandTheme, assets?: TemplateAssets) => void;
  removeSlide: (id: string) => void;
  updateBlock: (slideId: string, blockId: string, patch: Partial<PositionedBlock>) => void;
  replaceBlocks: (slideId: string, blocks: PositionedBlock[]) => void;
  addBlock: (slideId: string, block: PositionedBlock) => void;
  removeBlock: (slideId: string, blockId: string) => void;
  setSeed: (seed: number) => void;
  initFromTemplate: (templateId: string, theme: BrandTheme, assets?: TemplateAssets) => void;
  /** Aplica los assets del usuario (logo, decor A/B) a todos los slides
   *  existentes actualizando los bloques kind=decor y kind=logo en sitio. */
  applyAssetsToAllSlides: (assets: TemplateAssets, slideIndexToDecor?: (i: number) => 'A' | 'B') => void;
  /** Duplica un bloque con offset +20/+20 y lo selecciona. Devuelve el nuevo id. */
  duplicateBlock: (slideId: string, blockId: string) => string | null;
  /** Cambios de z-order. */
  bringToFront: (slideId: string, blockId: string) => void;
  sendToBack: (slideId: string, blockId: string) => void;
  bringForward: (slideId: string, blockId: string) => void;
  sendBackward: (slideId: string, blockId: string) => void;
  /** Toggle lock. */
  toggleLock: (slideId: string, blockId: string) => void;
  /**
   * Reordena los bloques del slide según el array de ids (el primero es
   * el más atrás, el último adelante). Recalcula `zIndex` secuencialmente
   * para que coincidan con el orden visible en el panel de capas.
   */
  reorderBlocks: (slideId: string, orderedBlockIds: string[]) => void;
  /** Background del slide activo. */
  setSlideBackground: (slideId: string, bg: SlideBackground | null) => void;
  /** Inserta un bloque de imagen en el centro del slide activo. */
  addImageBlock: (slideId: string, src: string, format: SlideFormat) => string;
  /** Inserta un bloque de texto nuevo. */
  addTextBlock: (slideId: string, text: string, format: SlideFormat, theme: BrandTheme) => string;
  /** Pega una copia de los bloques dados en el slide (con offset). Devuelve ids nuevos. */
  pasteBlocks: (slideId: string, blocks: PositionedBlock[]) => string[];
  /** Duplica el slide entero y lo inserta justo después. Devuelve el nuevo id. */
  duplicateSlide: (slideId: string) => string | null;
  /**
   * Replica el estilo/efectos de un bloque (no el texto) en todos los slides
   * con un bloque del mismo `kind`. Útil para "pintar" un look global desde
   * una slide que el usuario ya ajustó. Devuelve cuántos slides se tocaron.
   */
  applyBlockStyleToAllSlides: (slideId: string, blockId: string) => number;
  /**
   * Merge de textos generados por IA sobre los slides existentes. Preserva
   * fondo, decor, shapes, efectos, posiciones y z-order. Actualiza solo el
   * `text` del primer bloque headline (y del primer bloque text de soporte
   * si hay más líneas). Si no hay slides todavía devuelve `false` y el caller
   * debería usar `initFromTemplate` en su lugar.
   */
  mergeGeneratedTexts: (generated: Array<{ type: string; line1: string; line2?: string; number?: string; caption?: string }>) => boolean;
}

const initialState: ProjectState = {
  topic: 'Editor tipo Canva — drag&drop con snap',
  formatId: 'ig-4x5',
  themeId: 'default',
  slides: [],
  currentSlideId: '',
  seed: 42,
};

/**
 * Clon profundo del `content` de un bloque. Usado por
 * `applyBlockStyleToAllSlides` para asegurar que cada slide recibe una
 * copia independiente (mutar el overlay o los effects en una slide no
 * afecta a las otras).
 */
function cloneContent(c: PositionedBlock['content']): PositionedBlock['content'] {
  if (c.kind === 'image') {
    return { ...c, effects: c.effects ? c.effects.map((e) => ({ ...e })) : undefined };
  }
  if (c.kind === 'decor') {
    return {
      ...c,
      overlay: c.overlay ? { ...c.overlay } : undefined,
      effects: c.effects ? c.effects.map((e) => ({ ...e })) : undefined,
    };
  }
  if (c.kind === 'shape') {
    return { ...c };
  }
  if (c.kind === 'path') {
    return { ...c };
  }
  // text: no debería llegar aquí (el caller filtra), pero por type-safety:
  return { ...c };
}

/**
 * Combina el contenido destino con SÓLO los campos de estilo/efectos del
 * source. Preserva texto, src de imagen, forma y otros datos del destino.
 */
function replicateContentStyle(
  dest: PositionedBlock['content'],
  source: PositionedBlock['content'],
): PositionedBlock['content'] {
  if (dest.kind === 'text' && source.kind === 'text') {
    return {
      ...dest,
      fontRole: source.fontRole,
      fontSize: source.fontSize,
      fontWeight: source.fontWeight,
      fontStyle: source.fontStyle,
      letterSpacing: source.letterSpacing,
      lineHeight: source.lineHeight,
      textAlign: source.textAlign,
      color: source.color,
      upper: source.upper,
    };
  }
  if (dest.kind === 'image' && (source.kind === 'image' || source.kind === 'decor')) {
    return {
      ...dest,
      fit: source.kind === 'image' ? source.fit : dest.fit,
      effects: source.effects ? source.effects.map((e) => ({ ...e })) : undefined,
    };
  }
  if (dest.kind === 'decor' && (source.kind === 'decor' || source.kind === 'image')) {
    return {
      ...dest,
      overlay: source.kind === 'decor' ? source.overlay : dest.overlay,
      density: source.kind === 'decor' ? (source.density ?? dest.density) : dest.density,
      effects: source.effects ? source.effects.map((e) => ({ ...e })) : undefined,
    };
  }
  if (dest.kind === 'shape' && source.kind === 'shape') {
    return { ...dest, fill: source.fill, stroke: source.stroke, strokeWidth: source.strokeWidth, opacity: source.opacity };
  }
  return dest;
}

function buildSlide(
  type: SlideType,
  templateId: string,
  format: SlideFormat,
  theme: BrandTheme,
  seed: number,
  assets?: TemplateAssets,
): EditableSlide {
  const meta = findTemplate(templateId);
  const blocks = meta ? meta.initBlocks(type, format, theme, seed, assets) : [];
  return {
    id: nanoid(),
    type,
    templateId: (meta?.id ?? 'editorial') as TemplateId,
    blocks,
    seed,
  };
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  temporal(
    persist(
      (set, get) => ({
      ...initialState,

      setTopic: (topic) => set({ topic }),
      setFormatId: (formatId) => set({ formatId }),
      setCurrentSlideId: (currentSlideId) => set({ currentSlideId }),

      addSlide: (type, templateId, theme, assets) => {
        const format = FORMATS[get().formatId];
        const slide = buildSlide(type, templateId, format, theme, get().seed, assets);
        set((s) => ({ slides: [...s.slides, slide], currentSlideId: slide.id }));
      },

      removeSlide: (id) => set((s) => {
        const slides = s.slides.filter((x) => x.id !== id);
        const currentSlideId = s.currentSlideId === id ? (slides[0]?.id ?? '') : s.currentSlideId;
        return { slides, currentSlideId };
      }),

      updateBlock: (slideId, blockId, patch) => set((s) => ({
        slides: s.slides.map((slide) => slide.id !== slideId ? slide : {
          ...slide,
          blocks: slide.blocks.map((b) => b.id === blockId ? { ...b, ...patch, rect: patch.rect ? { ...b.rect, ...patch.rect } : b.rect } : b),
        }),
      })),

      replaceBlocks: (slideId, blocks) => set((s) => ({
        slides: s.slides.map((slide) => slide.id === slideId ? { ...slide, blocks } : slide),
      })),

      addBlock: (slideId, block) => set((s) => ({
        slides: s.slides.map((slide) => slide.id === slideId ? { ...slide, blocks: [...slide.blocks, block] } : slide),
      })),

      removeBlock: (slideId, blockId) => set((s) => ({
        slides: s.slides.map((slide) => slide.id === slideId ? { ...slide, blocks: slide.blocks.filter((b) => b.id !== blockId) } : slide),
      })),

      setSeed: (seed) => set({ seed }),

      initFromTemplate: (templateId, theme, assets) => {
        const format = FORMATS[get().formatId];
        const seed = Math.floor(Math.random() * 99999);
        const types: SlideType[] = ['cover', 'observation', 'contrast', 'quote', 'stat', 'cta'];
        const slides = types.map((t, i) => buildSlide(t, templateId, format, theme, seed + i * 1000, assets));
        set({ slides, currentSlideId: slides[0]?.id ?? '', seed });
      },

      duplicateBlock: (slideId, blockId) => {
        const slide = get().slides.find((x) => x.id === slideId);
        if (!slide) return null;
        const block = slide.blocks.find((b) => b.id === blockId);
        if (!block) return null;
        const clone: PositionedBlock = {
          ...block,
          id: nanoid(),
          rect: { ...block.rect, x: block.rect.x + 20, y: block.rect.y + 20 },
          zIndex: Math.max(...slide.blocks.map((b) => b.zIndex), 0) + 1,
        };
        set((s) => ({
          slides: s.slides.map((sl) => sl.id === slideId ? { ...sl, blocks: [...sl.blocks, clone] } : sl),
        }));
        return clone.id;
      },

      bringToFront: (slideId, blockId) => set((s) => ({
        slides: s.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          const maxZ = Math.max(...slide.blocks.map((b) => b.zIndex), 0);
          return { ...slide, blocks: slide.blocks.map((b) => b.id === blockId ? { ...b, zIndex: maxZ + 1 } : b) };
        }),
      })),

      sendToBack: (slideId, blockId) => set((s) => ({
        slides: s.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          const minZ = Math.min(...slide.blocks.map((b) => b.zIndex), 0);
          return { ...slide, blocks: slide.blocks.map((b) => b.id === blockId ? { ...b, zIndex: minZ - 1 } : b) };
        }),
      })),

      bringForward: (slideId, blockId) => set((s) => ({
        slides: s.slides.map((slide) => slide.id !== slideId ? slide : {
          ...slide,
          blocks: slide.blocks.map((b) => b.id === blockId ? { ...b, zIndex: b.zIndex + 1 } : b),
        }),
      })),

      sendBackward: (slideId, blockId) => set((s) => ({
        slides: s.slides.map((slide) => slide.id !== slideId ? slide : {
          ...slide,
          blocks: slide.blocks.map((b) => b.id === blockId ? { ...b, zIndex: b.zIndex - 1 } : b),
        }),
      })),

      toggleLock: (slideId, blockId) => set((s) => ({
        slides: s.slides.map((slide) => slide.id !== slideId ? slide : {
          ...slide,
          blocks: slide.blocks.map((b) => b.id === blockId ? { ...b, locked: !b.locked } : b),
        }),
      })),

      reorderBlocks: (slideId, orderedBlockIds) => set((s) => ({
        slides: s.slides.map((slide) => {
          if (slide.id !== slideId) return slide;
          // Toma los bloques en el orden nuevo; los que no están en el array
          // (edge case) se conservan al final.
          const byId = new Map(slide.blocks.map((b) => [b.id, b]));
          const ordered = orderedBlockIds.map((id) => byId.get(id)).filter((b): b is NonNullable<typeof b> => !!b);
          const missing = slide.blocks.filter((b) => !orderedBlockIds.includes(b.id));
          const fresh = [...ordered, ...missing];
          // Recalcula zIndex secuencialmente: el primero del array es el más atrás (zIndex 1).
          return {
            ...slide,
            blocks: fresh.map((b, i) => ({ ...b, zIndex: i + 1 })),
          };
        }),
      })),

      setSlideBackground: (slideId, background) => set((s) => ({
        slides: s.slides.map((slide) => slide.id !== slideId ? slide : {
          ...slide,
          background: background ?? undefined,
        }),
      })),

      addImageBlock: (slideId, src, format) => {
        const id = nanoid();
        const w = Math.min(format.width * 0.4, 600);
        const h = w;
        const block: PositionedBlock = {
          id, kind: 'decor',
          rect: { x: (format.width - w) / 2, y: (format.height - h) / 2, w, h },
          zIndex: 50,
          content: { kind: 'image', src, fit: 'contain' },
        };
        set((s) => ({
          slides: s.slides.map((sl) => sl.id === slideId ? { ...sl, blocks: [...sl.blocks, block] } : sl),
        }));
        return id;
      },

      pasteBlocks: (slideId, blocks) => {
        if (blocks.length === 0) return [];
        const slide = get().slides.find((x) => x.id === slideId);
        const baseZ = slide ? Math.max(...slide.blocks.map((b) => b.zIndex), 0) : 0;
        const newIds: string[] = [];
        const clones: PositionedBlock[] = blocks.map((b, i) => {
          const id = nanoid();
          newIds.push(id);
          return {
            ...b,
            id,
            rect: { ...b.rect, x: b.rect.x + 20, y: b.rect.y + 20 },
            zIndex: baseZ + 1 + i,
          };
        });
        set((s) => ({
          slides: s.slides.map((sl) => sl.id === slideId ? { ...sl, blocks: [...sl.blocks, ...clones] } : sl),
        }));
        return newIds;
      },

      mergeGeneratedTexts: (generated) => {
        const current = get().slides;
        if (current.length === 0) return false;
        const pickText = (g: (typeof generated)[number]): string[] => {
          // Lista de textos a colocar en los bloques de texto del slide.
          // Primero el line1, luego line2/number/caption si existen.
          // Descartamos strings vacíos o whitespace puro para no pisar
          // el placeholder con "" (causaba slides en blanco cuando el
          // LLM devolvía line1 corrupto).
          const push = (out: string[], v: string | undefined): void => {
            const t = typeof v === 'string' ? v.trim() : '';
            if (t.length > 0) out.push(t);
          };
          const out: string[] = [];
          push(out, g.line1);
          push(out, g.line2);
          push(out, g.number);
          push(out, g.caption);
          return out;
        };
        set((s) => ({
          slides: s.slides.map((slide, idx) => {
            const gen = generated[idx];
            if (!gen) return slide;
            const texts = pickText(gen);
            if (texts.length === 0) return slide;
            // Busca los bloques de texto. Prioriza:
            //   1. headline (el texto principal de la slide)
            //   2. number (stat slides)
            //   3. sub / kicker / caption (textos de soporte)
            // excluye logo / counter.
            const priorityOf = (kind: string): number => {
              if (kind === 'headline') return 0;
              if (kind === 'number') return 1;
              if (kind === 'sub') return 2;
              if (kind === 'kicker') return 3;
              if (kind === 'caption') return 4;
              return 99;
            };
            const candidates = slide.blocks
              .filter((b) => b.content.kind === 'text' && b.kind !== 'logo' && b.kind !== 'counter');
            const textBlocks = [...candidates].sort((a, b) => {
              const pa = priorityOf(a.kind);
              const pb = priorityOf(b.kind);
              if (pa !== pb) return pa - pb;
              return a.zIndex - b.zIndex;
            });
            // Asigna textos según el orden del sort (priorizado), no según
            // el orden del array `slide.blocks` que sigue el orden de creación.
            const textById = new Map<string, string>();
            textBlocks.forEach((b, i) => {
              const t = texts[i];
              if (t !== undefined) textById.set(b.id, t);
            });
            return {
              ...slide,
              type: (gen.type ?? slide.type) as SlideType,
              blocks: slide.blocks.map((b) => {
                if (b.content.kind !== 'text') return b;
                const newText = textById.get(b.id);
                if (newText === undefined) return b;
                return { ...b, content: { ...b.content, text: newText } };
              }),
            };
          }),
        }));
        return true;
      },

      applyBlockStyleToAllSlides: (slideId, blockId) => {
        const source = get().slides.find((s) => s.id === slideId)?.blocks.find((b) => b.id === blockId);
        if (!source) return 0;
        let touched = 0;

        // RAMA 1 — TEXTO. Copiamos estilo visual + efectos a todos los
        // bloques del mismo `kind` en las otras slides, PERO preservamos
        // el texto de cada destino (cover, observation, quote, etc. tienen
        // cada una su propia copia). Esto permite unificar color/fuente/
        // efectos globalmente sin pisar el contenido.
        if (source.content.kind === 'text') {
          set((s) => ({
            slides: s.slides.map((slide) => {
              if (slide.id === slideId) return slide;
              const matches = slide.blocks.filter((b) => b.kind === source.kind && b.content.kind === 'text');
              if (matches.length === 0) return slide;
              touched++;
              return {
                ...slide,
                blocks: slide.blocks.map((b) => {
                  if (b.kind !== source.kind || b.content.kind !== 'text') return b;
                  if (source.content.kind !== 'text') return b;
                  // Preserva `text` y `runs` (contenido único por slide)
                  // pero adopta estilos visuales + efectos del source.
                  const src = source.content;
                  return {
                    ...b,
                    rotation: source.rotation,
                    style: source.style ? { ...source.style } : undefined,
                    content: {
                      ...b.content,
                      // Propiedades tipográficas
                      fontRole: src.fontRole,
                      fontFamilyOverride: src.fontFamilyOverride,
                      fontSize: src.fontSize,
                      fontWeight: src.fontWeight,
                      fontStyle: src.fontStyle,
                      letterSpacing: src.letterSpacing,
                      lineHeight: src.lineHeight,
                      textAlign: src.textAlign,
                      upper: src.upper,
                      // Color / decoración
                      color: src.color,
                      underline: src.underline,
                      strike: src.strike,
                      stroke: src.stroke ? { ...src.stroke } : undefined,
                      gradientFill: src.gradientFill
                        ? { ...src.gradientFill, stops: src.gradientFill.stops.map((st) => ({ ...st })) }
                        : undefined,
                      // Efectos SVG (los efectos aplicables a texto)
                      effects: src.effects ? src.effects.map((e) => ({ ...e })) : undefined,
                    },
                  } as PositionedBlock;
                }),
              };
            }),
          }));
          return touched;
        }

        // RAMA 2 — IMAGEN / SHAPE / DECOR / PATH. Clonamos el bloque source
        // completo (rect, content, effects, rotation, style, zIndex). Si
        // ya hay un bloque del mismo `kind` en la slide destino, reemplazamos
        // el primero preservando su id. Si no hay, lo agregamos.
        set((s) => ({
          slides: s.slides.map((slide) => {
            if (slide.id === slideId) return slide;
            const existingIdx = slide.blocks.findIndex((b) => b.kind === source.kind);
            const cloned: PositionedBlock = {
              ...source,
              id: existingIdx >= 0 ? slide.blocks[existingIdx]!.id : nanoid(),
              rect: { ...source.rect },
              content: cloneContent(source.content),
            };
            touched++;
            if (existingIdx >= 0) {
              const next = slide.blocks.slice();
              next[existingIdx] = cloned;
              return { ...slide, blocks: next };
            }
            return { ...slide, blocks: [...slide.blocks, cloned] };
          }),
        }));
        return touched;
      },

      duplicateSlide: (slideId) => {
        const slide = get().slides.find((x) => x.id === slideId);
        if (!slide) return null;
        const newId = nanoid();
        const newBlocks = slide.blocks.map((b) => ({ ...b, id: nanoid() }));
        const copy: EditableSlide = {
          ...slide, id: newId, blocks: newBlocks, seed: slide.seed + 1,
          background: slide.background ? { ...slide.background } : undefined,
        };
        set((s) => {
          const idx = s.slides.findIndex((x) => x.id === slideId);
          const next = [...s.slides];
          next.splice(idx + 1, 0, copy);
          return { slides: next, currentSlideId: newId };
        });
        return newId;
      },

      addTextBlock: (slideId, text, format, theme) => {
        const id = nanoid();
        const w = format.width * 0.6;
        const h = 140;
        const block: PositionedBlock = {
          id, kind: 'headline',
          rect: { x: (format.width - w) / 2, y: (format.height - h) / 2, w, h },
          zIndex: 60,
          content: {
            kind: 'text', text, fontRole: 'display', fontSize: 64, fontWeight: 600,
            fontStyle: 'italic', letterSpacing: -1, lineHeight: 1.15,
            textAlign: 'start', color: theme.colors.primary,
          },
        };
        set((s) => ({
          slides: s.slides.map((sl) => sl.id === slideId ? { ...sl, blocks: [...sl.blocks, block] } : sl),
        }));
        return id;
      },

      /**
       * Recorre todos los slides. En cada uno reemplaza el `src` de los
       * bloques kind='decor' (alternando A/B por índice) y cambia el content
       * de los bloques kind='logo' entre imagen y texto según `assets.logoSrc`.
       * No toca posiciones, tamaños, ni otros bloques — sólo sincroniza los
       * assets visibles.
       */
      applyAssetsToAllSlides: (assets, slideIndexToDecor) => set((s) => ({
        slides: s.slides.map((slide, idx) => {
          const useA = slideIndexToDecor ? slideIndexToDecor(idx) === 'A' : idx % 2 === 0;
          const decorSrc =
            useA ? (assets.decorASrc ?? assets.decorBSrc ?? null)
                 : (assets.decorBSrc ?? assets.decorASrc ?? null);
          return {
            ...slide,
            blocks: slide.blocks.map((b) => {
              if (b.kind === 'decor' && b.content.kind === 'decor') {
                return {
                  ...b,
                  content: {
                    ...b.content,
                    mode: decorSrc ? 'image' as const : 'glitch' as const,
                    src: decorSrc ?? undefined,
                  },
                };
              }
              if (b.kind === 'logo') {
                if (assets.logoSrc) {
                  return { ...b, content: { kind: 'image' as const, src: assets.logoSrc, fit: 'contain' as const } };
                }
                if (b.content.kind !== 'text') {
                  return { ...b, content: { kind: 'text' as const, text: '{eterCore}', fontRole: 'script' as const, fontSize: 56, fontStyle: 'italic' as const, textAlign: 'start' as const, color: '#0A0A14' } };
                }
              }
              return b;
            }),
          };
        }),
      })),
      }),
      {
        name: 'carrousel-project',
        // Debounce de 350 ms: muchos set() consecutivos (drag, typing, etc.)
        // se agrupan en una sola escritura a localStorage.
        storage: createJSONStorage(() => createDebouncedLocalStorage(350)),
        partialize: (s) => ({
          topic: s.topic, formatId: s.formatId, themeId: s.themeId,
          slides: s.slides, currentSlideId: s.currentSlideId, seed: s.seed,
        }),
      },
    ),
    {
      limit: 50,
      // Trackea SOLO los campos de datos. Sin esto, zundo snapshot-ea las
      // funciones del store, y al hacer undo "restaura" esas funciones
      // sobreescribiendo las actuales y el merge shallow no aplica el cambio
      // visible de `slides` — causando que Ctrl+Z parezca no hacer nada.
      partialize: (state): Pick<ProjectState, 'topic' | 'formatId' | 'themeId' | 'slides' | 'currentSlideId' | 'seed'> => ({
        topic: state.topic,
        formatId: state.formatId,
        themeId: state.themeId,
        slides: state.slides,
        currentSlideId: state.currentSlideId,
        seed: state.seed,
      }),
    },
  ),
);

export const useProjectUndo = () => useProjectStore.temporal.getState();

// Dev: expone el store en window para debug/testing rápido
(globalThis as unknown as { __projectStore?: unknown }).__projectStore = useProjectStore;
