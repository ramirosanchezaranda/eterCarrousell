/**
 * EditorCanvas — editor tipo Canva sobre SVG.
 *  • Drag / resize / rotate con handles, snap a guides activos.
 *  • Doble click en bloque de texto → edición inline.
 *  • Right click → context menu (Eliminar / Duplicar / Z-order / Lock / Pegar imagen).
 *  • Ctrl+V / drop de archivo / drop desde galería → agrega imagen al slide.
 *  • Render del background del slide (solid / gradient / image) o bg del theme.
 *  • Motor de auto-fix opcional al soltar drag.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowUp, ArrowUpCircle, ArrowDownCircle, Copy, Clipboard as ClipboardIcon, Lock, Unlock, Scissors, Type } from 'lucide-react';
import type { PositionedBlock, Rect, SlideBackground, SlideFormat } from '@/domain';
import { FORMATS } from '@/formats';
import { findNearestSnap } from '@/guides';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';
import { useAssetsStore } from '@/state/assetsStore';
import { solveLayout } from '@/layout/engine';
import { BlockView } from '@/render/BlockView';
import { GuidesOverlay } from './GuidesOverlay';
import { SelectionHandles, type HandlePosition } from './SelectionHandles';
import { PathNodeEditor } from './PathNodeEditor';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { InlineTextEditor } from './InlineTextEditor';
import { BlockFloatingToolbar } from './BlockFloatingToolbar';
import { SmartGuidesOverlay } from './SmartGuidesOverlay';
import {
  buildTargets,
  computeSmartGuides,
  movableEdgesForHandle,
  type SmartGuidesResult,
} from './smartGuides';

interface DragState {
  blockId: string;
  mode: 'move' | 'resize' | 'rotate';
  handle?: HandlePosition;
  startPointer: { x: number; y: number };
  startRect: Rect;
  startRotation: number;
  /** Patch aplicado localmente durante el drag (no toca el store). */
  currentRect: Rect;
  currentRotation: number;
  /** Para multi-select move: bloques adicionales arrastrados con el primario.
   *  No aplicable a resize/rotate (en Canva tampoco se multi-resizea). */
  additionalBlocks?: Array<{ id: string; startRect: Rect; currentRect: Rect }>;
}

export function EditorCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const projectStore = useProjectStore();
  const ui = useUiStore();
  const assets = useAssetsStore();
  const { slides, currentSlideId, formatId, seed } = projectStore;
  const format: SlideFormat = FORMATS[formatId];
  const slide = slides.find((s) => s.id === currentSlideId) ?? slides[0];
  const [drag, setDrag] = useState<DragState | null>(null);
  const [smartGuides, setSmartGuides] = useState<SmartGuidesResult | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; blockId?: string; canvasX?: number; canvasY?: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // Medimos el WRAPPER PADRE (no el canvas mismo) para calcular cuánto
  // espacio tiene disponible y así dimensionar el canvas exactamente.
  // Problema que esto resuelve: con `width: 92%; height: 92%; aspect-ratio`
  // los tres valores pueden contradecirse y el browser rinde uno u otro
  // de forma inconsistente — el canvas aparecía cortado o deformado en
  // algunos viewports.
  const [parentSize, setParentSize] = useState<{ w: number; h: number }>({ w: 560, h: 700 });
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setParentSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Calcula tamaño óptimo del canvas: escala fit que respeta aspect-ratio
  // del slide y deja un pequeño margen (92% del espacio) para que no toque
  // los bordes del wrapper. Funciona idéntico a Canva/Figma: el slide
  // siempre cabe completo y respira.
  const fit = Math.min(
    (parentSize.w * 0.96) / format.width,
    (parentSize.h * 0.96) / format.height,
  );
  const canvasWidthPx = Math.max(120, Math.floor(format.width * fit));
  const canvasHeightPx = Math.max(120, Math.floor(format.height * fit));

  const zoom = ui.zoom;
  const pan = ui.pan;
  /**
   * Canvas FLUIDO: ocupa el máximo disponible del parent manteniendo
   * aspect-ratio del format. El parent (canvasWrapRef) es un flex centering
   * que le da altura completa. El navegador calcula width/height
   * respetando el aspect-ratio de manera que ambos `max-width: 100%` y
   * `max-height: 100%` se cumplan.
   *
   * El zoom interno del SVG se sigue manejando con `viewBox` (estilo
   * Photoshop/Figma): el tamaño visual del canvas no cambia al hacer
   * zoom, solo lo que se ve adentro.
   */
  const containerStyle = useMemo(() => ({
    // Dimensiones en PX calculadas con el fit exacto. No usamos % +
    // aspect-ratio porque los browsers resuelven inconsistentemente
    // cuando width, height y aspect-ratio coexisten.
    width: canvasWidthPx,
    height: canvasHeightPx,
    flexShrink: 0,
    boxShadow: '0 20px 60px rgba(46, 70, 200, 0.28)',
    borderRadius: 10,
    overflow: 'hidden',
    background: assets.theme.colors.bg,
    position: 'relative' as const,
  }), [assets.theme.colors.bg, canvasWidthPx, canvasHeightPx]);

  // Dimensiones del viewBox actual. A zoom=1 coinciden con el format
  // completo. A zoom=4 mostramos 1/4 del canvas en cada eje.
  const viewW = format.width / zoom;
  const viewH = format.height / zoom;

  // Clamp helper para mantener el pan dentro del canvas.
  const clampPan = useCallback((p: { x: number; y: number }, vw: number, vh: number) => ({
    x: Math.max(0, Math.min(format.width - vw, p.x)),
    y: Math.max(0, Math.min(format.height - vh, p.y)),
  }), [format]);

  /**
   * Wheel handler — registrado nativo con `{ passive: false }` para poder
   * hacer `preventDefault` (React onWheel es passive y el browser ignora
   * el preventDefault silenciosamente → historico bug del zoom del navegador).
   *
   *   - Ctrl/⌘ + scroll  → zoom-to-cursor (el punto bajo el mouse se queda
   *                         fijo en pantalla mientras el resto se acerca).
   *   - Scroll sin ctrl  → pan vertical (si zoom > 1).
   *   - Shift + scroll   → pan horizontal (si zoom > 1).
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const svgBounds = () => svgRef.current?.getBoundingClientRect() ?? null;

    const onWheel = (e: WheelEvent) => {
      const bounds = svgBounds();
      if (!bounds) return;
      const { zoom: z, pan: p } = useUiStore.getState();

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // Paso exponencial de 12% por notch. Mínimo 1x (no dejamos alejarse
        // del 100% para que el canvas no se vea recortado con bordes raros).
        const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
        const newZoom = Math.max(1, Math.min(4, Number((z * factor).toFixed(3))));
        if (newZoom === z) return;

        // Punto del cursor en coords del canvas (antes del zoom).
        const relX = (e.clientX - bounds.left) / bounds.width;
        const relY = (e.clientY - bounds.top) / bounds.height;
        const oldVW = format.width / z;
        const oldVH = format.height / z;
        const cursorCanvasX = p.x + relX * oldVW;
        const cursorCanvasY = p.y + relY * oldVH;

        // Nuevo pan: recalculamos para que el cursor siga apuntando al
        // mismo punto del canvas después del zoom.
        const newVW = format.width / newZoom;
        const newVH = format.height / newZoom;
        const newPan = clampPan({
          x: cursorCanvasX - relX * newVW,
          y: cursorCanvasY - relY * newVH,
        }, newVW, newVH);

        ui.setZoom(newZoom);
        ui.setPan(newPan);
        return;
      }

      // Sin Ctrl: pan (solo útil cuando hay zoom, si no no hay a dónde ir).
      if (z <= 1.01) return;
      e.preventDefault();
      // Paneo en unidades de canvas proporcional al delta del mouse.
      // `speedFactor` es el ratio unidades-canvas/pixel-pantalla.
      const speedFactor = (format.width / zoom) / bounds.width;
      const dx = (e.shiftKey ? e.deltaY : e.deltaX) * speedFactor;
      const dy = (e.shiftKey ? 0 : e.deltaY) * speedFactor;
      const newPan = clampPan({
        x: p.x + dx,
        y: p.y + dy,
      }, viewW, viewH);
      ui.setPan(newPan);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [format, ui, clampPan, viewW, viewH, zoom]);

  /**
   * Convierte coords de pantalla (mouse/pointer) a coords del canvas
   * teniendo en cuenta el viewBox actual (que incluye zoom y pan).
   *
   *   canvasX = pan.x + relX * (format.width / zoom)
   */
  const pointerToCanvas = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vx = (e.clientX - rect.left) / rect.width;
    const vy = (e.clientY - rect.top) / rect.height;
    return {
      x: pan.x + vx * viewW,
      y: pan.y + vy * viewH,
    };
  }, [pan.x, pan.y, viewW, viewH]);

  const onBlockPointerDown = (block: PositionedBlock, e: ReactPointerEvent<SVGElement>) => {
    if (e.button !== 0) return; // ignora right-click (eso lo maneja onContextMenu)
    // En mobile (touch) NO iniciamos drag: solo seleccionamos, para que el
    // gesto de un dedo siga haciendo scroll de la página. El drag/resize en
    // mobile se hace editando x/y/w/h desde el PropertiesPanel a la derecha.
    if (e.pointerType === 'touch') {
      ui.selectBlock(block.id, e.shiftKey);
      return;
    }
    e.stopPropagation();
    if (block.locked) { ui.selectBlock(block.id, e.shiftKey); return; }
    (e.target as Element).setPointerCapture(e.pointerId);

    // Multi-drag: si el bloque ya estaba en una selección múltiple, NO la
    // alteramos y arrastramos todos juntos. Si no, seleccionamos el bloque
    // (con shift suma a la selección) y arrastramos solo este.
    const inMultiSelection =
      ui.selectedBlockIds.includes(block.id) && ui.selectedBlockIds.length > 1;
    let extraIds: string[] = [];
    if (inMultiSelection) {
      // Mantener la selección actual
      extraIds = ui.selectedBlockIds.filter((id) => id !== block.id);
    } else {
      ui.selectBlock(block.id, e.shiftKey);
    }
    const additional = extraIds
      .map((id) => slide?.blocks.find((b) => b.id === id))
      .filter((b): b is PositionedBlock => !!b && !b.locked)
      .map((b) => ({ id: b.id, startRect: { ...b.rect }, currentRect: { ...b.rect } }));

    setDrag({
      blockId: block.id,
      mode: 'move',
      startPointer: pointerToCanvas(e),
      startRect: { ...block.rect },
      startRotation: block.rotation ?? 0,
      currentRect: { ...block.rect },
      currentRotation: block.rotation ?? 0,
      additionalBlocks: additional.length > 0 ? additional : undefined,
    });
  };

  const onBlockDoubleClick = (block: PositionedBlock, e: React.MouseEvent) => {
    e.stopPropagation();
    if (block.content.kind === 'text') {
      setEditing(block.id);
      ui.selectBlock(block.id);
    }
  };

  const onCanvasDoubleClick = (_e: React.MouseEvent<SVGSVGElement>) => {
    if (!slide) return;
    const newId = projectStore.addTextBlock(slide.id, 'Nuevo texto', format, assets.theme);
    ui.setSelectedBlockIds([newId]);
  };

  const onBlockContextMenu = (block: PositionedBlock, e: ReactPointerEvent<SVGElement> | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ui.selectedBlockIds.includes(block.id)) ui.selectBlock(block.id);
    setMenu({ x: e.clientX, y: e.clientY, blockId: block.id });
  };

  const onCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const cp = pointerToCanvas(e);
    setMenu({ x: e.clientX, y: e.clientY, canvasX: cp.x, canvasY: cp.y });
  };

  const onHandleDown = (block: PositionedBlock, handle: HandlePosition, e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({
      blockId: block.id,
      mode: handle === 'rotate' ? 'rotate' : 'resize',
      handle,
      startPointer: pointerToCanvas(e),
      startRect: { ...block.rect },
      startRotation: block.rotation ?? 0,
      currentRect: { ...block.rect },
      currentRotation: block.rotation ?? 0,
    });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || !slide) return;
    const p = pointerToCanvas(e);
    const dx = p.x - drag.startPointer.x;
    const dy = p.y - drag.startPointer.y;
    // Drag local: solo actualiza state del componente. No toca el store.
    // El render lee `drag.currentRect/currentRotation` para el bloque activo.
    if (drag.mode === 'move') {
      // 1. Posición tentativa con el delta del puntero.
      let nx = drag.startRect.x + dx;
      let ny = drag.startRect.y + dy;

      // 2. Smart guides: alineación a otros bloques + canvas + safe margins.
      //    Computamos sobre el AABB UNIÓN si hay multi-select (Canva trata
      //    el grupo como una sola caja para alinear).
      const draggedIds = drag.additionalBlocks
        ? [drag.blockId, ...drag.additionalBlocks.map((a) => a.id)]
        : [drag.blockId];
      const tentativeRects = computeMoveRects(drag, nx - drag.startRect.x, ny - drag.startRect.y);
      const unionRect = unionAabb(tentativeRects.map((r) => r.rect));
      const targets = ui.smartGuidesEnabled
        ? buildTargets(slide.blocks, draggedIds, format)
        : [];
      const sg = ui.smartGuidesEnabled
        ? computeSmartGuides({
            dragRect: unionRect,
            dragRotation: 0, // unión ya es AABB
            targets,
            threshold: ui.snapThresholdPx,
          })
        : null;

      // 3. Aplicar snap delta de smart guides al delta total.
      if (sg && (sg.snap.dx !== 0 || sg.snap.dy !== 0)) {
        nx += sg.snap.dx;
        ny += sg.snap.dy;
      }

      // 4. Snap a guías composicionales (rule-of-thirds, etc.) si están activos.
      //    Aplicado DESPUÉS del smart-snap; gana el más cercano.
      if (ui.snapEnabled && ui.activeGuides.length > 0) {
        const snap = findNearestSnap({ x: nx, y: ny }, ui.activeGuides, format, ui.snapThresholdPx);
        if (snap) { nx = snap.x; ny = snap.y; }
      }

      // 5. Re-computar smart guides post-snap final para que las líneas
      //    se rendericen exactamente sobre el rect final.
      const finalDelta = { dx: nx - drag.startRect.x, dy: ny - drag.startRect.y };
      const finalRects = computeMoveRects(drag, finalDelta.dx, finalDelta.dy);
      const finalUnion = unionAabb(finalRects.map((r) => r.rect));
      const finalSg = ui.smartGuidesEnabled
        ? computeSmartGuides({
            dragRect: finalUnion,
            dragRotation: 0,
            targets,
            threshold: ui.snapThresholdPx,
            applySnap: false,
          })
        : null;
      setSmartGuides(finalSg);

      // 6. Aplicar a primary + additional.
      const newAdditional = drag.additionalBlocks?.map((a) => ({
        ...a,
        currentRect: { ...a.startRect, x: a.startRect.x + finalDelta.dx, y: a.startRect.y + finalDelta.dy },
      }));
      setDrag({
        ...drag,
        currentRect: { ...drag.startRect, x: nx, y: ny },
        additionalBlocks: newAdditional,
      });
    } else if (drag.mode === 'resize') {
      let rect = resolveResize(drag.startRect, drag.handle!, dx, dy);

      // Smart guides en resize: solo snap a los edges que efectivamente
      // estén moviéndose (left para 'w', right para 'e', etc.).
      if (ui.smartGuidesEnabled) {
        const targets = buildTargets(slide.blocks, [drag.blockId], format);
        const sg = computeSmartGuides({
          dragRect: rect,
          dragRotation: drag.startRotation,
          targets,
          threshold: ui.snapThresholdPx,
          movableEdges: movableEdgesForHandle(drag.handle ?? ''),
          // Equal gaps no aplican durante resize (cambia tamaño, no posición).
          computeEqualGaps: false,
        });
        // Aplicamos el delta al edge correspondiente (no al rect completo).
        rect = applyResizeSnap(rect, drag.handle!, sg.snap);
        const finalSg = computeSmartGuides({
          dragRect: rect,
          dragRotation: drag.startRotation,
          targets,
          threshold: ui.snapThresholdPx,
          movableEdges: movableEdgesForHandle(drag.handle ?? ''),
          computeEqualGaps: false,
          applySnap: false,
        });
        setSmartGuides(finalSg);
      }

      setDrag({ ...drag, currentRect: rect });
    } else if (drag.mode === 'rotate') {
      const cx = drag.startRect.x + drag.startRect.w / 2;
      const cy = drag.startRect.y + drag.startRect.h / 2;
      const angle = Math.atan2(p.y - cy, p.x - cx) * (180 / Math.PI) + 90;
      setDrag({ ...drag, currentRotation: Math.round(angle) });
      setSmartGuides(null);
    }
  };

  const onPointerUp = () => {
    if (!drag || !slide) { setDrag(null); setSmartGuides(null); return; }
    // Commit del drag al store solo al soltar. Un único set → un único
    // snapshot en zundo y una sola escritura a localStorage.
    const patch = drag.mode === 'rotate'
      ? { rotation: drag.currentRotation }
      : { rect: drag.currentRect };
    projectStore.updateBlock(slide.id, drag.blockId, patch);
    // En multi-drag, también commiteamos los bloques adicionales.
    if (drag.mode === 'move' && drag.additionalBlocks) {
      for (const a of drag.additionalBlocks) {
        projectStore.updateBlock(slide.id, a.id, { rect: a.currentRect });
      }
    }
    // Evaluación de auto-fix sobre el estado FUTURO (con todos los patches).
    const additionalById = new Map(
      (drag.additionalBlocks ?? []).map((a) => [a.id, a.currentRect]),
    );
    const nextBlocks = slide.blocks.map((b) => {
      if (b.id === drag.blockId) {
        return {
          ...b,
          ...(drag.mode === 'rotate' ? { rotation: drag.currentRotation } : { rect: drag.currentRect }),
        };
      }
      const moved = additionalById.get(b.id);
      if (moved) return { ...b, rect: moved };
      return b;
    });
    const result = solveLayout(nextBlocks, format, {
      backgroundColor: assets.theme.colors.bg,
      autoFix: ui.autoFixEnabled,
    });
    if (ui.autoFixEnabled && result.warnings.length > 0) {
      projectStore.replaceBlocks(slide.id, result.blocks);
      if (result.warnings.some((w) => w.autoFixed)) ui.flashAutoFix();
    }
    ui.setWarnings(result.warnings);
    setDrag(null);
    setSmartGuides(null);
  };

  const onBackgroundDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    ui.clearSelection();
  };

  const onDrop = async (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!slide) return;
    // Drop desde galería (data-galleryid) o desde filesystem
    const galleryId = e.dataTransfer.getData('application/x-gallery-id');
    if (galleryId) {
      const du = assets.galleryData[galleryId];
      if (du) projectStore.addImageBlock(slide.id, du, format);
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      const dataURI = await fileToDataURI(file);
      projectStore.addImageBlock(slide.id, dataURI, format);
    }
  };

  if (!slide) {
    return (
      <div style={{ ...containerStyle, aspectRatio: `${format.width} / ${format.height}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', padding: 40, textAlign: 'center' }}>
        Elegí una plantilla del panel izquierdo para empezar.
      </div>
    );
  }

  // Scale px/canvas-unit DESPUÉS del zoom interno (viewBox): handles y
  // toolbar deben verse al mismo tamaño visual independientemente del zoom,
  // así que compensamos multiplicando por `zoom`.
  const screenScale = (canvasWidthPx / format.width) * zoom;
  const scale = screenScale; // alias — más claro en el resto del componente.
  const background: SlideBackground = slide.background ?? { kind: 'solid', color: assets.theme.colors.bg };
  const editingBlock = editing ? slide.blocks.find((b) => b.id === editing) : null;

  const canvasContextMenuItems = (): ContextMenuItem[] => [
    {
      key: 'add-text',
      label: 'Agregar texto',
      icon: <Type size={12} />,
      hotkey: 'T',
      onSelect: () => {
        if (!slide) return;
        const newId = projectStore.addTextBlock(slide.id, 'Nuevo texto', format, assets.theme);
        ui.setSelectedBlockIds([newId]);
      },
    },
    { key: 'sep0', label: '', separator: true, onSelect: () => {} },
    {
      key: 'paste-image',
      label: 'Pegar imagen del portapapeles',
      icon: <ClipboardIcon size={12} />,
      onSelect: async () => {
        try {
          const clipboard = navigator.clipboard as Clipboard & { read?: () => Promise<ClipboardItem[]> };
          if (!clipboard.read) return;
          const items = await clipboard.read();
          for (const it of items) {
            for (const type of it.types) {
              if (!type.startsWith('image/')) continue;
              const blob = await it.getType(type);
              const dataURI = await blobToDataURI(blob);
              projectStore.addImageBlock(slide.id, dataURI, format);
              return;
            }
          }
        } catch (err) { console.warn(err); }
      },
    },
    {
      key: 'clear-selection',
      label: 'Deseleccionar todo',
      onSelect: () => ui.clearSelection(),
    },
  ];

  const blockContextMenuItems = (blockId: string): ContextMenuItem[] => {
    const b = slide.blocks.find((x) => x.id === blockId);
    if (!b) return [];
    return [
      {
        key: 'add-text',
        label: 'Agregar texto',
        icon: <Type size={12} />,
        hotkey: 'T',
        onSelect: () => {
          const newId = projectStore.addTextBlock(slide.id, 'Nuevo texto', format, assets.theme);
          ui.setSelectedBlockIds([newId]);
        },
      },
      { key: 'sep-addtext', label: '', separator: true, onSelect: () => {} },
      { key: 'dup', label: 'Duplicar',        icon: <Copy size={12} />,     hotkey: 'Ctrl+D', onSelect: () => { const nid = projectStore.duplicateBlock(slide.id, blockId); if (nid) ui.setSelectedBlockIds([nid]); } },
      { key: 'cut', label: 'Eliminar',        icon: <Scissors size={12} />, hotkey: 'Del',    danger: true, onSelect: () => { projectStore.removeBlock(slide.id, blockId); ui.clearSelection(); } },
      { key: 'sep1', label: '', separator: true, onSelect: () => {} },
      { key: 'front', label: 'Traer al frente', icon: <ArrowUpCircle size={12} />,   hotkey: 'Ctrl+]', onSelect: () => projectStore.bringToFront(slide.id, blockId) },
      { key: 'up',    label: 'Subir',           icon: <ArrowUp size={12} />,         onSelect: () => projectStore.bringForward(slide.id, blockId) },
      { key: 'down',  label: 'Bajar',           icon: <ArrowDown size={12} />,       onSelect: () => projectStore.sendBackward(slide.id, blockId) },
      { key: 'back',  label: 'Enviar al fondo', icon: <ArrowDownCircle size={12} />, hotkey: 'Ctrl+[', onSelect: () => projectStore.sendToBack(slide.id, blockId) },
      { key: 'sep2', label: '', separator: true, onSelect: () => {} },
      { key: 'lock', label: b.locked ? 'Desbloquear' : 'Bloquear', icon: b.locked ? <Unlock size={12} /> : <Lock size={12} />, onSelect: () => projectStore.toggleLock(slide.id, blockId) },
    ];
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onContextMenu={onCanvasContextMenu}
    >
      <svg
        ref={svgRef}
        viewBox={`${pan.x} ${pan.y} ${viewW} ${viewH}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y', userSelect: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerDown={onBackgroundDown}
        onDoubleClick={onCanvasDoubleClick}
      >
        <SlideBackgroundRender bg={background} width={format.width} height={format.height} />
        {slide.blocks
          .slice()
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((block) => {
            // Aplica el patch local del drag al primario y a los adicionales (multi-select).
            let live = block as PositionedBlock;
            if (drag) {
              if (drag.blockId === block.id) {
                live = { ...block, rect: drag.currentRect, rotation: drag.currentRotation };
              } else if (drag.additionalBlocks) {
                const a = drag.additionalBlocks.find((x) => x.id === block.id);
                if (a) live = { ...block, rect: a.currentRect };
              }
            }
            return (
              <g
                key={block.id}
                onPointerDown={(e) => onBlockPointerDown(block, e)}
                onDoubleClick={(e) => onBlockDoubleClick(block, e as unknown as React.MouseEvent)}
                onContextMenu={(e) => onBlockContextMenu(block, e as unknown as React.MouseEvent)}
                style={{ cursor: block.locked ? 'default' : 'move', opacity: editing === block.id ? 0 : 1 }}
              >
                <BlockView block={live} theme={assets.theme} fonts={assets.theme.fonts} seed={seed} />
              </g>
            );
          })}
        {ui.activeGuides.length > 0 && (
          <GuidesOverlay format={format} activeGuideIds={ui.activeGuides} color={assets.theme.colors.primary} />
        )}
        {/* Smart guides estilo Canva: solo durante drag/resize activo. */}
        {smartGuides && (smartGuides.guides.length > 0 || smartGuides.distances.length > 0 || smartGuides.equalGaps.length > 0) && (
          <SmartGuidesOverlay
            guides={smartGuides.guides}
            distances={smartGuides.distances}
            equalGaps={smartGuides.equalGaps}
            scale={scale}
          />
        )}
        {ui.selectedBlockIds.map((id) => {
          const b = slide.blocks.find((bl) => bl.id === id);
          if (!b) return null;
          // Cuando un path está en edición de nodos, no mostramos los handles
          // de rect (serían confusos); mostramos solo los puntos.
          if (ui.pathEditingBlockId === b.id && b.content.kind === 'path') return null;
          // Handles siguen el rect en vivo durante el drag (primary + additionals).
          let liveRect = b.rect;
          if (drag) {
            if (drag.blockId === b.id) liveRect = drag.currentRect;
            else {
              const add = drag.additionalBlocks?.find((a) => a.id === b.id);
              if (add) liveRect = add.currentRect;
            }
          }
          return (
            <SelectionHandles
              key={id}
              rect={liveRect}
              scale={scale}
              onHandleDown={(h, ev) => onHandleDown(b, h, ev)}
            />
          );
        })}
        {/* Editor de nodos: puntos del path arrastrables. */}
        {ui.pathEditingBlockId && (() => {
          const pb = slide.blocks.find((b) => b.id === ui.pathEditingBlockId);
          if (!pb || pb.content.kind !== 'path') return null;
          return <PathNodeEditor block={pb} slideId={slide.id} format={format} />;
        })()}
      </svg>
      {/**
       * Toolbar flotante contextual: aparece sobre el bloque seleccionado
       * con acciones rápidas (bold/italic/color en textos, reemplazar en
       * imágenes, duplicar/eliminar/lock/z-order en todos). No aparece si
       * hay selección múltiple, si está en edición inline, o si está en
       * modo edición de nodos de path.
       */}
      {ui.selectedBlockIds.length === 1 && !editing && (() => {
        const selId = ui.selectedBlockIds[0]!;
        const sel = slide.blocks.find((b) => b.id === selId);
        if (!sel) return null;
        if (ui.pathEditingBlockId === sel.id) return null;
        const live = drag && drag.blockId === sel.id ? drag.currentRect : sel.rect;
        return (
          <BlockFloatingToolbar
            block={sel}
            slideId={slide.id}
            scale={scale}
            panX={pan.x}
            panY={pan.y}
            liveRect={live}
          />
        );
      })()}
      {editingBlock && editingBlock.content.kind === 'text' && (
        <InlineTextEditor
          block={editingBlock}
          slideId={slide.id}
          format={format}
          canvasWidthPx={canvasWidthPx}
          fonts={assets.theme.fonts}
          onDone={() => setEditing(null)}
        />
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.blockId ? blockContextMenuItems(menu.blockId) : canvasContextMenuItems()}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

/** Render del background del slide como primer hijo del SVG. */
function SlideBackgroundRender({ bg, width, height }: { bg: SlideBackground; width: number; height: number }) {
  if (bg.kind === 'solid') {
    return <rect width={width} height={height} fill={bg.color} />;
  }
  if (bg.kind === 'gradient') {
    const id = `bg-grad-${Math.round(bg.angle)}`;
    const rad = (bg.angle - 90) * (Math.PI / 180);
    const x1 = 0.5 - Math.cos(rad) * 0.5, y1 = 0.5 - Math.sin(rad) * 0.5;
    const x2 = 0.5 + Math.cos(rad) * 0.5, y2 = 0.5 + Math.sin(rad) * 0.5;
    return (
      <>
        <defs>
          <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
            {bg.stops.map((s, i) => <stop key={i} offset={s.at} stopColor={s.color} />)}
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill={`url(#${id})`} />
      </>
    );
  }
  // image
  const fit = bg.fit === 'contain' ? 'xMidYMid meet' : bg.fit === 'cover' ? 'xMidYMid slice' : 'none';
  return (
    <g opacity={bg.opacity ?? 1}>
      <rect width={width} height={height} fill="#000" opacity={0.05} />
      {bg.src && <image href={bg.src} x={0} y={0} width={width} height={height} preserveAspectRatio={fit} />}
    </g>
  );
}

function resolveResize(start: Rect, handle: HandlePosition, dx: number, dy: number): Rect {
  let { x, y, w, h } = start;
  if (handle.includes('e')) w = Math.max(20, start.w + dx);
  if (handle.includes('s')) h = Math.max(20, start.h + dy);
  if (handle.includes('w')) { const nw = Math.max(20, start.w - dx); x = start.x + (start.w - nw); w = nw; }
  if (handle.includes('n')) { const nh = Math.max(20, start.h - dy); y = start.y + (start.h - nh); h = nh; }
  return { x, y, w, h };
}

/**
 * Aplica el snap de smart guides a un rect en resize. El snap viene como
 * un delta global (dx, dy) pero solo aplica al edge que se está moviendo.
 * Ej: handle 'e' → mueve el right edge → ajusta `w` por dx; ignora dy.
 */
function applyResizeSnap(rect: Rect, handle: HandlePosition, snap: { dx: number; dy: number }): Rect {
  let { x, y, w, h } = rect;
  if (handle.includes('e')) w = Math.max(20, w + snap.dx);
  if (handle.includes('w')) { const nw = Math.max(20, w - snap.dx); x = x + (w - nw); w = nw; }
  if (handle.includes('s')) h = Math.max(20, h + snap.dy);
  if (handle.includes('n')) { const nh = Math.max(20, h - snap.dy); y = y + (h - nh); h = nh; }
  return { x, y, w, h };
}

/**
 * Calcula los rects tentativos de todos los bloques arrastrados (primary
 * + additionals) aplicando el delta. Útil para construir el AABB unión.
 */
function computeMoveRects(
  drag: DragState,
  dx: number,
  dy: number,
): Array<{ id: string; rect: Rect }> {
  const out: Array<{ id: string; rect: Rect }> = [
    {
      id: drag.blockId,
      rect: { ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy },
    },
  ];
  for (const a of drag.additionalBlocks ?? []) {
    out.push({
      id: a.id,
      rect: { ...a.startRect, x: a.startRect.x + dx, y: a.startRect.y + dy },
    });
  }
  return out;
}

/** AABB unión de varios rects. */
function unionAabb(rects: ReadonlyArray<Rect>): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}
function blobToDataURI(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(blob);
  });
}
