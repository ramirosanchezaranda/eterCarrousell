/**
 * Atajos de teclado globales del editor. Divididos en capas:
 *
 *   Globales (sin importar selección):
 *     Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z  → undo/redo
 *     Ctrl+A                          → seleccionar todos los bloques del slide
 *     Ctrl+S                          → descargar slide actual (JPEG)
 *     Ctrl+Shift+S                    → descargar todas las slides
 *     Ctrl+Shift+D                    → duplicar slide completo
 *     PageDown / PageUp               → slide siguiente / anterior
 *     Alt+←  /  Alt+→                 → idem (teclados sin PageUp/PageDown)
 *     ? / Ctrl+/                      → abre modal de ayuda
 *     Escape                          → deselecciona o cierra modal
 *
 *   Con selección:
 *     Delete / Backspace              → eliminar bloques
 *     Ctrl+C / Ctrl+X / Ctrl+V        → copy / cut / paste (clipboard interno)
 *     Ctrl+D                          → duplicar bloques seleccionados
 *     Ctrl+L                          → toggle lock
 *     Ctrl+] / Ctrl+[                 → subir/bajar en z-order
 *     Arrow keys                      → nudge 1 px (Shift = 10 px)
 *
 * Se deshabilita cuando el foco está en input/textarea/contentEditable
 * para no interferir con edición de texto.
 */
import { useEffect } from 'react';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';

/**
 * undo/redo "smart": zundo puede acumular snapshots intermedios que son
 * visualmente idénticos al current (por sets internos de stores derivados).
 * Retrocedemos hasta que el slice visible cambie (o terminemos el past).
 */
export function smartUndo(): void {
  const proj = useProjectStore;
  const sigBefore = JSON.stringify(proj.getState().slides);
  for (let i = 0; i < 10; i++) {
    const t = proj.temporal.getState();
    if (t.pastStates.length === 0) return;
    t.undo();
    const sigAfter = JSON.stringify(proj.getState().slides);
    if (sigAfter !== sigBefore) return;
  }
}
export function smartRedo(): void {
  const proj = useProjectStore;
  const sigBefore = JSON.stringify(proj.getState().slides);
  for (let i = 0; i < 10; i++) {
    const t = proj.temporal.getState();
    if (t.futureStates.length === 0) return;
    t.redo();
    const sigAfter = JSON.stringify(proj.getState().slides);
    if (sigAfter !== sigBefore) return;
  }
}

interface KeyboardOptions {
  downloadCurrent?: () => void;
  downloadAll?: () => void;
}

export function useKeyboardShortcuts(opts: KeyboardOptions = {}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
      const project = useProjectStore.getState();
      const ui = useUiStore.getState();
      const slideId = project.currentSlideId;
      const slide = project.slides.find((s) => s.id === slideId);
      const selected = ui.selectedBlockIds;
      const mod = e.ctrlKey || e.metaKey;

      // Modal de ayuda: '?' y Ctrl+/ siempre abren (incluso desde inputs)
      if ((e.key === '?' && e.shiftKey) || (mod && e.key === '/')) {
        e.preventDefault();
        ui.setShowShortcutsHelp(true);
        return;
      }

      if (isTyping) return;

      // Escape: cierra modal si está abierto, sino limpia selección
      if (e.key === 'Escape') {
        if (ui.showShortcutsHelp) { ui.setShowShortcutsHelp(false); return; }
        ui.clearSelection();
        return;
      }

      // ───── Globales ─────
      if (mod && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault(); smartUndo(); return;
      }
      if (mod && ((e.key === 'y' || e.key === 'Y') || ((e.key === 'z' || e.key === 'Z') && e.shiftKey))) {
        e.preventDefault(); smartRedo(); return;
      }

      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (slide) ui.setSelectedBlockIds(slide.blocks.map((b) => b.id));
        return;
      }

      if (mod && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); opts.downloadAll?.(); return;
      }
      if (mod && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); opts.downloadCurrent?.(); return;
      }

      // Zoom: Ctrl+= / Ctrl++ → zoom in, Ctrl+- → zoom out, Ctrl+0 → reset
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const z = ui.zoom;
        ui.setZoom(Math.min(4, z * 1.25));
        return;
      }
      if (mod && e.key === '-') {
        e.preventDefault();
        const z = ui.zoom;
        ui.setZoom(Math.max(0.25, z / 1.25));
        return;
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        ui.resetView();
        return;
      }

      if (mod && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        project.duplicateSlide(slideId);
        // `duplicateSlide` ya setea currentSlideId en el mismo set. No llamar
        // a setCurrentSlideId aparte porque crearía un snapshot extra y
        // Ctrl+Z requeriría apretarse dos veces.
        return;
      }

      // Navegación de slides
      if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        const i = project.slides.findIndex((s) => s.id === slideId);
        const next = project.slides[i + 1];
        if (next) project.setCurrentSlideId(next.id);
        return;
      }
      if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        const i = project.slides.findIndex((s) => s.id === slideId);
        const prev = project.slides[i - 1];
        if (prev) project.setCurrentSlideId(prev.id);
        return;
      }

      // Paste — vive también sin selección (pega si hay algo en clipboard)
      if (mod && (e.key === 'v' || e.key === 'V') && !e.shiftKey) {
        if (ui.clipboardBlocks.length > 0 && slide) {
          e.preventDefault();
          const newIds = project.pasteBlocks(slide.id, ui.clipboardBlocks);
          if (newIds.length) ui.setSelectedBlockIds(newIds);
          return;
        }
        // Si no hay clipboard interno, dejamos que el handler de documento (galería) tome el paste.
      }

      // ───── Con selección ─────
      if (selected.length === 0) return;
      if (!slide) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        selected.forEach((id) => project.removeBlock(slideId, id));
        ui.clearSelection();
        return;
      }

      if (mod && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        const blocks = slide.blocks.filter((b) => selected.includes(b.id));
        ui.setClipboardBlocks(blocks.map((b) => ({ ...b })));
        return;
      }

      if (mod && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        const blocks = slide.blocks.filter((b) => selected.includes(b.id));
        ui.setClipboardBlocks(blocks.map((b) => ({ ...b })));
        selected.forEach((id) => project.removeBlock(slideId, id));
        ui.clearSelection();
        return;
      }

      if (mod && (e.key === 'd' || e.key === 'D') && !e.shiftKey) {
        e.preventDefault();
        const newIds: string[] = [];
        selected.forEach((id) => {
          const nid = project.duplicateBlock(slideId, id);
          if (nid) newIds.push(nid);
        });
        if (newIds.length) ui.setSelectedBlockIds(newIds);
        return;
      }

      if (mod && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        selected.forEach((id) => project.toggleLock(slideId, id));
        return;
      }

      if (mod && e.key === ']') {
        e.preventDefault();
        selected.forEach((id) => project.bringForward(slideId, id));
        return;
      }
      if (mod && e.key === '[') {
        e.preventDefault();
        selected.forEach((id) => project.sendBackward(slideId, id));
        return;
      }

      // Nudge
      const nudge = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0;
      const dy = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0;
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        selected.forEach((id) => {
          const b = slide.blocks.find((x) => x.id === id);
          if (!b || b.locked) return;
          project.updateBlock(slideId, id, { rect: { ...b.rect, x: b.rect.x + dx, y: b.rect.y + dy } });
        });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [opts]);
}
