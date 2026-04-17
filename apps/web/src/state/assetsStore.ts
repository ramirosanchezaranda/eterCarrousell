/**
 * Store de assets: logo, decor A/B, custom fonts, theme.
 * Los blobs (dataURIs) se guardan en IndexedDB vía idb-keyval y se hidratan
 * a memoria al mount (`hydrateFromIdb()`). localStorage guarda solo ids
 * y metadata — las dataURIs grandes nunca pasan por ahí.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createDebouncedLocalStorage } from './debouncedStorage';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { nanoid } from 'nanoid';
import type { BrandTheme, CustomFont, CustomFontMeta, GalleryImage } from '@/domain';
import { BRAND, FONT_PRESETS, DEFAULT_FONT_KEY } from '@/domain';

function defaultTheme(): BrandTheme {
  const preset = FONT_PRESETS[DEFAULT_FONT_KEY] ?? Object.values(FONT_PRESETS)[0]!;
  return {
    id: 'default',
    colors: {
      primary: BRAND.blue,
      bg: BRAND.cream,
      ink: BRAND.ink,
      light: BRAND.blueLight,
      accents: [BRAND.blue, BRAND.blueLight, BRAND.blueDark],
    },
    fonts: {
      display: preset.display,
      sans: preset.sans,
      script: preset.script,
      mono: preset.mono,
      googleFamilies: preset.googleFamilies,
    },
    customFonts: [],
  };
}

export interface AssetsState {
  // Refs persistidas (solo ids/metadata)
  logoId: string | null;
  decorAId: string | null;
  decorBId: string | null;
  customDisplay: CustomFontMeta | null;
  customSans: CustomFontMeta | null;
  fontKey: string;
  theme: BrandTheme;

  // Cache en memoria (no persiste, se hidrata desde IDB)
  logoDataURI: string | null;
  decorADataURI: string | null;
  decorBDataURI: string | null;
  customDisplayDataURI: string | null;
  customSansDataURI: string | null;
  hydrated: boolean;

  // Galería de imágenes reutilizables — metadata en localStorage, dataURIs en IDB
  gallery: Array<Pick<GalleryImage, 'id' | 'name'>>;
  galleryData: Record<string, string>; // id → dataURI (in-memory cache)

  // Galería de fuentes: metadatos persistidos, fontFace se re-registra al hidratar
  fontGallery: CustomFontMeta[];
}

export interface AssetsActions {
  setLogo: (dataURI: string | null) => Promise<void>;
  setDecorA: (dataURI: string | null) => Promise<void>;
  setDecorB: (dataURI: string | null) => Promise<void>;
  setCustomDisplay: (font: CustomFont | null) => Promise<void>;
  setCustomSans: (font: CustomFont | null) => Promise<void>;
  setFontKey: (key: string) => void;
  setAccents: (accents: string[]) => void;
  hydrateFromIdb: () => Promise<void>;

  addGalleryImage: (dataURI: string, name?: string) => Promise<string>;
  removeGalleryImage: (id: string) => Promise<void>;
  getGalleryDataURI: (id: string) => string | null;

  /** Galería de fuentes custom — N fuentes en paralelo, no solo 2. */
  addCustomFont: (font: CustomFont) => Promise<void>;
  removeCustomFont: (internalName: string) => Promise<void>;
  /**
   * Marca una fuente de la galería como Display o Sans activa del theme.
   * Pasar null en `internalName` quita el override y vuelve al preset base.
   */
  assignGalleryFontToSlot: (internalName: string | null, slot: 'display' | 'sans') => void;
}

async function storeAsset(dataURI: string | null, prevId: string | null): Promise<string | null> {
  if (prevId) await idbDel(prevId).catch(() => {});
  if (!dataURI) return null;
  const id = `asset-${nanoid()}`;
  await idbSet(id, dataURI);
  return id;
}

async function storeFont(font: CustomFont | null, prevInternalName: string | null): Promise<{ meta: CustomFontMeta | null; dataURI: string | null }> {
  if (prevInternalName) await idbDel(prevInternalName).catch(() => {});
  if (!font) return { meta: null, dataURI: null };
  await idbSet(font.internalName, font.dataURI);
  return {
    meta: { internalName: font.internalName, fileName: font.fileName, format: font.format, role: font.role },
    dataURI: font.dataURI,
  };
}

/**
 * Reconstruye `theme.fonts` aplicando el preset activo + los overrides de
 * fuentes custom si existen. Llamada desde `setFontKey`, `setCustomDisplay`
 * y `setCustomSans` para que los slides reflejen las fuentes actuales.
 */
function rebuildThemeFonts(
  state: AssetsState & AssetsActions,
  override: { customDisplay?: CustomFontMeta | null; customSans?: CustomFontMeta | null },
): BrandTheme {
  const preset = FONT_PRESETS[state.fontKey] ?? Object.values(FONT_PRESETS)[0]!;
  const display = 'customDisplay' in override ? override.customDisplay : state.customDisplay;
  const sans = 'customSans' in override ? override.customSans : state.customSans;
  return {
    ...state.theme,
    fonts: {
      display: display ? `"${display.internalName}", ${preset.display}` : preset.display,
      sans: sans ? `"${sans.internalName}", ${preset.sans}` : preset.sans,
      script: preset.script,
      mono: preset.mono,
      googleFamilies: preset.googleFamilies,
    },
  };
}

/** Re-registra una fuente en document.fonts desde un dataURI (al rehidratar). */
async function registerFontFromDataURI(meta: CustomFontMeta, dataURI: string): Promise<void> {
  try {
    const face = new FontFace(meta.internalName, `url(${dataURI})`);
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    console.warn('No se pudo re-registrar fuente custom', meta.internalName, err);
  }
}

export const useAssetsStore = create<AssetsState & AssetsActions>()(
  persist(
    (set, get) => ({
      logoId: null,
      decorAId: null,
      decorBId: null,
      customDisplay: null,
      customSans: null,
      fontKey: DEFAULT_FONT_KEY,
      theme: defaultTheme(),

      logoDataURI: null,
      decorADataURI: null,
      decorBDataURI: null,
      customDisplayDataURI: null,
      customSansDataURI: null,
      hydrated: false,

      gallery: [],
      galleryData: {},
      fontGallery: [],

      setLogo: async (dataURI) => {
        const id = await storeAsset(dataURI, get().logoId);
        set({ logoId: id, logoDataURI: dataURI ?? null });
      },
      setDecorA: async (dataURI) => {
        const id = await storeAsset(dataURI, get().decorAId);
        set({ decorAId: id, decorADataURI: dataURI ?? null });
      },
      setDecorB: async (dataURI) => {
        const id = await storeAsset(dataURI, get().decorBId);
        set({ decorBId: id, decorBDataURI: dataURI ?? null });
      },
      setCustomDisplay: async (font) => {
        const prev = get().customDisplay?.internalName ?? null;
        const { meta, dataURI } = await storeFont(font, prev);
        set((s) => ({
          customDisplay: meta,
          customDisplayDataURI: dataURI,
          theme: rebuildThemeFonts(s, { customDisplay: meta }),
        }));
      },
      setCustomSans: async (font) => {
        const prev = get().customSans?.internalName ?? null;
        const { meta, dataURI } = await storeFont(font, prev);
        set((s) => ({
          customSans: meta,
          customSansDataURI: dataURI,
          theme: rebuildThemeFonts(s, { customSans: meta }),
        }));
      },
      setFontKey: (fontKey) => {
        const preset = FONT_PRESETS[fontKey];
        if (!preset) return;
        set((s) => ({
          fontKey,
          theme: rebuildThemeFonts({ ...s, fontKey } as AssetsState & AssetsActions, {}),
        }));
      },
      setAccents: (accents) => set((s) => ({
        theme: { ...s.theme, colors: { ...s.theme.colors, accents } },
      })),
      hydrateFromIdb: async () => {
        if (get().hydrated) return;
        const { logoId, decorAId, decorBId, customDisplay, customSans, gallery } = get();
        const [logoDU, decorADU, decorBDU, displayDU, sansDU, ...galleryDUs] = await Promise.all([
          logoId ? idbGet<string>(logoId) : Promise.resolve(null),
          decorAId ? idbGet<string>(decorAId) : Promise.resolve(null),
          decorBId ? idbGet<string>(decorBId) : Promise.resolve(null),
          customDisplay ? idbGet<string>(customDisplay.internalName) : Promise.resolve(null),
          customSans ? idbGet<string>(customSans.internalName) : Promise.resolve(null),
          ...gallery.map((g) => idbGet<string>(g.id)),
        ]);
        if (customDisplay && displayDU) await registerFontFromDataURI(customDisplay, displayDU);
        if (customSans && sansDU) await registerFontFromDataURI(customSans, sansDU);
        // Re-registra cada fuente de la galería desde IDB
        const galleryFonts = get().fontGallery;
        for (const meta of galleryFonts) {
          const du = await idbGet<string>(meta.internalName);
          if (du) await registerFontFromDataURI(meta, du);
        }
        const galleryData: Record<string, string> = {};
        gallery.forEach((g, i) => {
          const du = galleryDUs[i];
          if (du) galleryData[g.id] = du;
        });
        set({
          logoDataURI: logoDU ?? null,
          decorADataURI: decorADU ?? null,
          decorBDataURI: decorBDU ?? null,
          customDisplayDataURI: displayDU ?? null,
          customSansDataURI: sansDU ?? null,
          galleryData,
          hydrated: true,
        });
      },

      addGalleryImage: async (dataURI, name) => {
        const id = `gal-${nanoid()}`;
        await idbSet(id, dataURI);
        set((s) => ({
          gallery: [...s.gallery, { id, name }],
          galleryData: { ...s.galleryData, [id]: dataURI },
        }));
        return id;
      },

      removeGalleryImage: async (id) => {
        await idbDel(id).catch(() => {});
        set((s) => {
          const { [id]: _, ...rest } = s.galleryData;
          void _;
          return {
            gallery: s.gallery.filter((g) => g.id !== id),
            galleryData: rest,
          };
        });
      },

      getGalleryDataURI: (id) => get().galleryData[id] ?? null,

      addCustomFont: async (font) => {
        await idbSet(font.internalName, font.dataURI);
        set((s) => ({
          fontGallery: [...s.fontGallery.filter((f) => f.internalName !== font.internalName), {
            internalName: font.internalName, fileName: font.fileName, format: font.format, role: font.role,
          }],
        }));
      },

      removeCustomFont: async (internalName) => {
        await idbDel(internalName).catch(() => {});
        set((s) => {
          const patch: Partial<AssetsState> = {
            fontGallery: s.fontGallery.filter((f) => f.internalName !== internalName),
          };
          // Si la fuente que quitamos era la activa de algún slot, la limpiamos.
          const wasDisplay = s.customDisplay?.internalName === internalName;
          const wasSans = s.customSans?.internalName === internalName;
          if (wasDisplay) {
            patch.customDisplay = null;
            patch.customDisplayDataURI = null;
          }
          if (wasSans) {
            patch.customSans = null;
            patch.customSansDataURI = null;
          }
          if (wasDisplay || wasSans) {
            patch.theme = rebuildThemeFonts(
              { ...s, ...patch } as AssetsState & AssetsActions,
              {
                ...(wasDisplay ? { customDisplay: null } : {}),
                ...(wasSans ? { customSans: null } : {}),
              },
            );
          }
          return patch as AssetsState;
        });
      },

      assignGalleryFontToSlot: (internalName, slot) => {
        set((s) => {
          const meta = internalName
            ? s.fontGallery.find((f) => f.internalName === internalName) ?? null
            : null;
          const patch: Partial<AssetsState> = {};
          if (slot === 'display') {
            patch.customDisplay = meta;
            patch.theme = rebuildThemeFonts(s as AssetsState & AssetsActions, { customDisplay: meta });
          } else {
            patch.customSans = meta;
            patch.theme = rebuildThemeFonts(s as AssetsState & AssetsActions, { customSans: meta });
          }
          return patch as AssetsState;
        });
      },
    }),
    {
      name: 'carrousel-assets',
      storage: createJSONStorage(() => createDebouncedLocalStorage(350)),
      partialize: (s) => ({
        logoId: s.logoId,
        decorAId: s.decorAId,
        decorBId: s.decorBId,
        customDisplay: s.customDisplay,
        customSans: s.customSans,
        fontKey: s.fontKey,
        theme: s.theme,
        gallery: s.gallery,
        fontGallery: s.fontGallery,
      }),
    },
  ),
);
