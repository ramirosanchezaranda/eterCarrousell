/**
 * Estado del editor (no persiste): selección, guides activos, snap,
 * zoom, tab activo, feedback de warnings, loading/downloading flags.
 */
import { create } from 'zustand';
import type { GuideId, PositionedBlock } from '@/domain';
import type { Warning as EngineWarning } from '@/layout/engine';

// Re-export para mantener el nombre semántico en UI
export type UiWarning = EngineWarning;

export type EditorTab = 'template' | 'generate' | 'content' | 'brand' | 'assets' | 'format' | 'guides' | 'layers' | 'gallery' | 'background' | 'fonts';

export interface UiState {
  activeTab: EditorTab;
  selectedBlockIds: string[];
  activeGuides: GuideId[];
  snapEnabled: boolean;
  snapThresholdPx: number;
  /** Smart guides estilo Canva: alineación a otros bloques, distancias en
   *  px, equal-gap markers. Activo por default; toggle desde el menú "Ver". */
  smartGuidesEnabled: boolean;
  showBoundingBoxes: boolean;
  gridVisible: boolean;
  zoom: number;
  loading: boolean;
  downloading: boolean;
  error: string | null;
  warnings: UiWarning[];
  showAutoFixToast: boolean;
  autoFixEnabled: boolean;
  /** Clipboard interno de bloques — guarda copias cuando el user hace Ctrl+C/X. */
  clipboardBlocks: PositionedBlock[];
  /** Abre el modal de ayuda de shortcuts. */
  showShortcutsHelp: boolean;
  /** id del bloque path que está en "modo edición de nodos". null = ninguno. */
  pathEditingBlockId: string | null;
  /**
   * Opacidad (0..1) por guide activa. Si no hay entry para un id, el overlay
   * usa `defaultGuideOpacity`. Esto permite que el usuario baje algunas
   * guides a casi invisibles y resalte otras.
   */
  /**
   * Colapso manual de cada sidebar. En mobile el layout las oculta
   * automáticamente (via `useLayout`); en desktop/tablet el usuario puede
   * colapsarlas con botones en la TopBar para recuperar espacio del canvas.
   */
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  /** Mobile bottom-sheet: cuál tab está abierta (null = cerrado). */
  mobileSheet: 'left' | 'right' | null;
  /**
   * Pan del viewport del canvas en coordenadas del slide (no pixels de
   * pantalla). `pan.x = 0, pan.y = 0` muestra el canvas entero desde el
   * origen; al acercar (zoom > 1) + pan se ven regiones internas.
   * Se clampeamos en el Canvas para que nunca salga del `format`.
   */
  pan: { x: number; y: number };
  /** Modo fullscreen del canvas: oculta sidebars, topbar y statusbar,
   *  dejando solo el canvas para preview distraction-free. */
  canvasFullscreen: boolean;
  /** Modal con grid de todas las slides del carrusel. Click en una
   *  navega a esa slide y cierra el modal. */
  gridViewOpen: boolean;
  guideOpacity: Partial<Record<GuideId, number>>;
  /** Opacidad default cuando una guide no tiene override. Subimos a 0.85
   *  porque el default histórico (0.5) era demasiado tenue sobre fondos
   *  claros y el usuario reportó que no se veían bien. */
  defaultGuideOpacity: number;
  /** Multiplicador global del strokeWidth de las guides (1 = default,
   *  sube hasta 3 para presentaciones o clases). */
  guideStrokeMultiplier: number;
}

export interface UiActions {
  setActiveTab: (t: EditorTab) => void;
  setSelectedBlockIds: (ids: string[]) => void;
  selectBlock: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  toggleGuide: (id: GuideId) => void;
  setSnapEnabled: (v: boolean) => void;
  setSmartGuidesEnabled: (v: boolean) => void;
  setZoom: (z: number) => void;
  setLoading: (v: boolean) => void;
  setDownloading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setWarnings: (w: UiWarning[]) => void;
  flashAutoFix: () => void;
  setShowBoundingBoxes: (v: boolean) => void;
  setGridVisible: (v: boolean) => void;
  setAutoFixEnabled: (v: boolean) => void;
  setClipboardBlocks: (blocks: PositionedBlock[]) => void;
  setShowShortcutsHelp: (v: boolean) => void;
  setPathEditingBlockId: (id: string | null) => void;
  setLeftSidebarCollapsed: (v: boolean) => void;
  setRightSidebarCollapsed: (v: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setMobileSheet: (v: 'left' | 'right' | null) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
  toggleCanvasFullscreen: () => void;
  setGridViewOpen: (v: boolean) => void;
  setGuideOpacity: (id: GuideId, v: number) => void;
  setDefaultGuideOpacity: (v: number) => void;
  setGuideStrokeMultiplier: (v: number) => void;
}

export const useUiStore = create<UiState & UiActions>((set, get) => ({
  activeTab: 'template',
  selectedBlockIds: [],
  activeGuides: [],
  snapEnabled: true,
  snapThresholdPx: 8,
  smartGuidesEnabled: true,
  showBoundingBoxes: true,
  gridVisible: false,
  zoom: 1,
  loading: false,
  downloading: false,
  error: null,
  warnings: [],
  showAutoFixToast: false,
  autoFixEnabled: false,
  clipboardBlocks: [],
  showShortcutsHelp: false,
  pathEditingBlockId: null,
  guideOpacity: {},
  defaultGuideOpacity: 0.85,
  guideStrokeMultiplier: 1.5,
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  mobileSheet: null,
  pan: { x: 0, y: 0 },
  canvasFullscreen: false,
  gridViewOpen: false,

  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedBlockIds: (selectedBlockIds) => set({ selectedBlockIds }),
  selectBlock: (id, additive) => set((s) => ({
    selectedBlockIds: additive ? Array.from(new Set([...s.selectedBlockIds, id])) : [id],
  })),
  clearSelection: () => set({ selectedBlockIds: [] }),
  toggleGuide: (id) => set((s) => ({
    activeGuides: s.activeGuides.includes(id) ? s.activeGuides.filter((g) => g !== id) : [...s.activeGuides, id],
  })),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setSmartGuidesEnabled: (smartGuidesEnabled) => set({ smartGuidesEnabled }),
  setZoom: (zoom) => set({ zoom }),
  setLoading: (loading) => set({ loading }),
  setDownloading: (downloading) => set({ downloading }),
  setError: (error) => set({ error }),
  setWarnings: (warnings) => set({ warnings }),
  flashAutoFix: () => {
    set({ showAutoFixToast: true });
    setTimeout(() => {
      if (get().showAutoFixToast) set({ showAutoFixToast: false });
    }, 1800);
  },
  setShowBoundingBoxes: (showBoundingBoxes) => set({ showBoundingBoxes }),
  setGridVisible: (gridVisible) => set({ gridVisible }),
  setAutoFixEnabled: (autoFixEnabled) => set({ autoFixEnabled }),
  setClipboardBlocks: (clipboardBlocks) => set({ clipboardBlocks }),
  setShowShortcutsHelp: (showShortcutsHelp) => set({ showShortcutsHelp }),
  setPathEditingBlockId: (pathEditingBlockId) => set({ pathEditingBlockId }),
  setLeftSidebarCollapsed: (leftSidebarCollapsed) => set({ leftSidebarCollapsed }),
  setRightSidebarCollapsed: (rightSidebarCollapsed) => set({ rightSidebarCollapsed }),
  toggleLeftSidebar: () => set((s) => ({ leftSidebarCollapsed: !s.leftSidebarCollapsed })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarCollapsed: !s.rightSidebarCollapsed })),
  setMobileSheet: (mobileSheet) => set({ mobileSheet }),
  setPan: (pan) => set({ pan }),
  // Reset combinado: vuelve a zoom 1x y pan {0,0}. Lo llama el botón
  // "fit" de la TopBar y la acción de reset del canvas.
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
  toggleCanvasFullscreen: () => set((s) => ({ canvasFullscreen: !s.canvasFullscreen })),
  setGridViewOpen: (gridViewOpen) => set({ gridViewOpen }),
  setGuideOpacity: (id, v) => set((s) => ({
    guideOpacity: { ...s.guideOpacity, [id]: Math.max(0, Math.min(1, v)) },
  })),
  setDefaultGuideOpacity: (v) => set({ defaultGuideOpacity: Math.max(0, Math.min(1, v)) }),
  setGuideStrokeMultiplier: (v) => set({ guideStrokeMultiplier: Math.max(0.5, Math.min(4, v)) }),
}));
