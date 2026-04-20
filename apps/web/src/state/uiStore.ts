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
  showBoundingBoxes: boolean;
  gridVisible: boolean;
  zoom: number;
  panX: number;
  panY: number;
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
}

export interface UiActions {
  setActiveTab: (t: EditorTab) => void;
  setSelectedBlockIds: (ids: string[]) => void;
  selectBlock: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  toggleGuide: (id: GuideId) => void;
  setSnapEnabled: (v: boolean) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  setView: (zoom: number, panX: number, panY: number) => void;
  resetView: () => void;
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
}

export const useUiStore = create<UiState & UiActions>((set, get) => ({
  activeTab: 'template',
  selectedBlockIds: [],
  activeGuides: [],
  snapEnabled: true,
  snapThresholdPx: 8,
  showBoundingBoxes: true,
  gridVisible: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  loading: false,
  downloading: false,
  error: null,
  warnings: [],
  showAutoFixToast: false,
  autoFixEnabled: false,
  clipboardBlocks: [],
  showShortcutsHelp: false,
  pathEditingBlockId: null,

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
  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  setView: (zoom, panX, panY) => set({ zoom, panX, panY }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
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
}));
