/**
 * EditorCanvas — editor tipo Canva sobre SVG.
 *  • Drag / resize / rotate con handles, snap a guides activos.
 *  • Doble click en bloque de texto → edición inline.
 *  • Right click → context menu (Eliminar / Duplicar / Z-order / Lock / Pegar imagen).
 *  • Ctrl+V / drop de archivo / drop desde galería → agrega imagen al slide.
 *  • Render del background del slide (solid / gradient / image) o bg del theme.
 *  • Motor de auto-fix opcional al soltar drag.
 *  • Zoom con Ctrl+scroll / pinch (2 dedos). Pan con scroll / spacebar+drag.
 *    El zoom es puramente visual (CSS transform) — no toca coordenadas del store.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowUp, ArrowUpCircle, ArrowDownCircle, Copy, Clipboard as ClipboardIcon, Lock, Unlock, Scissors } from 'lucide-react';
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

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

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
}

export function EditorCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomWrapperRef = useRef<HTMLDivElement | null>(null);
  const projectStore = useProjectStore();
  const ui = useUiStore();
  const assets = useAssetsStore();
  const { slides, currentSlideId, formatId, seed } = projectStore;
  const format: SlideFormat = FORMATS[formatId];
  const slide = slides.find((s) => s.id === currentSlideId) ?? slides[0];
  const [drag, setDrag] = useState<DragState | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; blockId?: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [canvasWidthPx, setCanvasWidthPx] = useState(560);
  const [isSpacePan, setIsSpacePan] = useState(false);

  // Stable refs — kept in sync each render, consumed by effect closures
  // without needing to re-register listeners on every zoom/pan change.
  const zoomRef = useRef(ui.zoom);
  const panXRef = useRef(ui.panX);
  const panYRef = useRef(ui.panY);
  zoomRef.current = ui.zoom;
  panXRef.current = ui.panX;
  panYRef.current = ui.panY;

  // Spacebar pan tracking
  const spaceDown = useRef(false);
  const panDragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);

  // Lets the pinch effect cancel an in-progress block drag when a 2nd pointer lands.
  const cancelDragRef = useRef<(() => void) | null>(null);
  cancelDragRef.current = drag ? () => setDrag(null) : null;

  const containerStyle = useMemo(() => ({
    maxWidth: 560,
    margin: '0 auto',
    boxShadow: '0 30px 80px rgba(46, 70, 200, 0.3)',
    borderRadius: 8,
    overflow: 'hidden',
    background: assets.theme.colors.bg,
    position: 'relative' as const,
    cursor: isSpacePan ? 'grab' : undefined,
  }), [assets.theme.colors.bg, isSpacePan]);

  // ── Wheel: Ctrl/Cmd → zoom centered on cursor, else pan ──────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { setZoom, setPan } = useUiStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const currentZoom = zoomRef.current;
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));
        const newPanX = cx - (cx - panXRef.current) * (newZoom / currentZoom);
        const newPanY = cy - (cy - panYRef.current) * (newZoom / currentZoom);
        setZoom(newZoom);
        setPan(newPanX, newPanY);
      } else {
        setPan(panXRef.current - e.deltaX, panYRef.current - e.deltaY);
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []); // stable: all values accessed through refs or direct store calls

  // ── Pinch zoom via PointerEvent (capture phase, so it fires before SVG) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: {
      dist: number; zoom: number; panX: number; panY: number; cx: number; cy: number;
    } | null = null;

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        cancelDragRef.current?.(); // cancel any active block drag
        const pts = Array.from(pointers.values());
        const p0 = pts[0]!, p1 = pts[1]!;
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const rect = container.getBoundingClientRect();
        pinchStart = {
          dist,
          zoom: zoomRef.current,
          panX: panXRef.current,
          panY: panYRef.current,
          cx: (p0.x + p1.x) / 2 - rect.left,
          cy: (p0.y + p1.y) / 2 - rect.top,
        };
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2 && pinchStart) {
        // Intercept in capture phase — SVG block drag never sees these events.
        e.stopImmediatePropagation();
        const pts = Array.from(pointers.values());
        const p0 = pts[0]!, p1 = pts[1]!;
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const factor = dist / pinchStart.dist;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStart.zoom * factor));
        const { cx, cy } = pinchStart;
        const newPanX = cx - (cx - pinchStart.panX) * (newZoom / pinchStart.zoom);
        const newPanY = cy - (cy - pinchStart.panY) * (newZoom / pinchStart.zoom);
        const { setZoom, setPan } = useUiStore.getState();
        setZoom(newZoom);
        setPan(newPanX, newPanY);
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
    };

    container.addEventListener('pointerdown', onDown, { capture: true });
    container.addEventListener('pointermove', onMove, { capture: true });
    container.addEventListener('pointerup', onUp, { capture: true });
    container.addEventListener('pointercancel', onUp, { capture: true });
    return () => {
      container.removeEventListener('pointerdown', onDown, { capture: true });
      container.removeEventListener('pointermove', onMove, { capture: true });
      container.removeEventListener('pointerup', onUp, { capture: true });
      container.removeEventListener('pointercancel', onUp, { capture: true });
    };
  }, []);

  // ── Spacebar → pan cursor mode ────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      spaceDown.current = true;
      setIsSpacePan(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceDown.current = false;
      setIsSpacePan(false);
      panDragRef.current = null;
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ── pointerToCanvas: mapea coordenadas viewport → espacio canvas SVG ──────
  // getBoundingClientRect devuelve el rect visual post-CSS-transform, por lo
  // que esta función ya compensa el zoom sin ningún cambio adicional.
  const pointerToCanvas = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vx = (e.clientX - rect.left) / rect.width;
    const vy = (e.clientY - rect.top) / rect.height;
    return { x: vx * format.width, y: vy * format.height };
  }, [format]);

  const onBlockPointerDown = (block: PositionedBlock, e: ReactPointerEvent<SVGElement>) => {
    if (e.button !== 0) return; // ignora right-click (eso lo maneja onContextMenu)
    e.stopPropagation();
    if (block.locked) { ui.selectBlock(block.id, e.shiftKey); return; }
    (e.target as Element).setPointerCapture(e.pointerId);
    ui.selectBlock(block.id, e.shiftKey);
    setDrag({
      blockId: block.id,
      mode: 'move',
      startPointer: pointerToCanvas(e),
      startRect: { ...block.rect },
      startRotation: block.rotation ?? 0,
      currentRect: { ...block.rect },
      currentRotation: block.rotation ?? 0,
    });
  };

  const onBlockDoubleClick = (block: PositionedBlock) => {
    if (block.content.kind === 'text') {
      setEditing(block.id);
      ui.selectBlock(block.id);
    }
  };

  const onBlockContextMenu = (block: PositionedBlock, e: ReactPointerEvent<SVGElement> | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ui.selectedBlockIds.includes(block.id)) ui.selectBlock(block.id);
    setMenu({ x: e.clientX, y: e.clientY, blockId: block.id });
  };

  const onCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
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
    // Spacebar+drag pan: el SVG captura el pointer, así que recibimos los
    // eventos aquí incluso fuera del área original.
    if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      useUiStore.getState().setPan(
        panDragRef.current.startPanX + dx,
        panDragRef.current.startPanY + dy,
      );
      return;
    }
    if (!drag || !slide) return;
    const p = pointerToCanvas(e);
    const dx = p.x - drag.startPointer.x;
    const dy = p.y - drag.startPointer.y;
    // Drag local: solo actualiza state del componente. No toca el store.
    if (drag.mode === 'move') {
      let nx = drag.startRect.x + dx;
      let ny = drag.startRect.y + dy;
      if (ui.snapEnabled && ui.activeGuides.length > 0) {
        const snap = findNearestSnap({ x: nx, y: ny }, ui.activeGuides, format, ui.snapThresholdPx);
        if (snap) { nx = snap.x; ny = snap.y; }
      }
      setDrag({ ...drag, currentRect: { ...drag.startRect, x: nx, y: ny } });
    } else if (drag.mode === 'resize') {
      const rect = resolveResize(drag.startRect, drag.handle!, dx, dy);
      setDrag({ ...drag, currentRect: rect });
    } else if (drag.mode === 'rotate') {
      const cx = drag.startRect.x + drag.startRect.w / 2;
      const cy = drag.startRect.y + drag.startRect.h / 2;
      const angle = Math.atan2(p.y - cy, p.x - cx) * (180 / Math.PI) + 90;
      setDrag({ ...drag, currentRotation: Math.round(angle) });
    }
  };

  const onPointerUp = () => {
    if (panDragRef.current) { panDragRef.current = null; return; }
    if (!drag || !slide) { setDrag(null); return; }
    // Commit del drag al store solo al soltar. Un único set → un único
    // snapshot en zundo y una sola escritura a localStorage.
    const patch = drag.mode === 'rotate'
      ? { rotation: drag.currentRotation }
      : { rect: drag.currentRect };
    projectStore.updateBlock(slide.id, drag.blockId, patch);
    // Evaluación de auto-fix sobre el estado FUTURO (con el patch aplicado).
    const nextBlocks = slide.blocks.map((b) => b.id === drag.blockId
      ? { ...b, ...(drag.mode === 'rotate' ? { rotation: drag.currentRotation } : { rect: drag.currentRect }) }
      : b);
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
  };

  const onBackgroundDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (spaceDown.current) {
      // Spacebar+drag pan: capturamos el pointer para recibir move/up fuera del SVG.
      (e.target as Element).setPointerCapture(e.pointerId);
      panDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panXRef.current,
        startPanY: panYRef.current,
      };
      return;
    }
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

  const scale = canvasWidthPx / format.width;
  const zoom = ui.zoom;
  const background: SlideBackground = slide.background ?? { kind: 'solid', color: assets.theme.colors.bg };
  const editingBlock = editing ? slide.blocks.find((b) => b.id === editing) : null;

  const canvasContextMenuItems = (): ContextMenuItem[] => [
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
      ref={(el) => { containerRef.current = el; if (el) setCanvasWidthPx(el.clientWidth); }}
      style={containerStyle}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onContextMenu={onCanvasContextMenu}
    >
      {/* Zoom + pan wrapper — transforms are purely visual.
          position: relative makes InlineTextEditor's absolute positioning
          relative to this wrapper (same coordinate space as the SVG). */}
      <div
        ref={zoomWrapperRef}
        style={{
          transform: `translate(${ui.panX}px, ${ui.panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'relative',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${format.width} ${format.height}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerDown={onBackgroundDown}
        >
          <SlideBackgroundRender bg={background} width={format.width} height={format.height} />
          {slide.blocks
            .slice()
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((block) => {
              // Aplica el patch local del drag solo al bloque que se está moviendo.
              const live = drag && drag.blockId === block.id
                ? { ...block, rect: drag.currentRect, rotation: drag.currentRotation }
                : block;
              return (
                <g
                  key={block.id}
                  onPointerDown={(e) => onBlockPointerDown(block, e)}
                  onDoubleClick={() => onBlockDoubleClick(block)}
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
          {ui.selectedBlockIds.map((id) => {
            const b = slide.blocks.find((bl) => bl.id === id);
            if (!b) return null;
            // Cuando un path está en edición de nodos, no mostramos los handles
            // de rect (serían confusos); mostramos solo los puntos.
            if (ui.pathEditingBlockId === b.id && b.content.kind === 'path') return null;
            // Handles siguen el rect en vivo durante el drag.
            const liveRect = drag && drag.blockId === b.id ? drag.currentRect : b.rect;
            return (
              <SelectionHandles
                key={id}
                rect={liveRect}
                scale={scale * zoom}
                onHandleDown={(h, ev) => onHandleDown(b, h, ev)}
              />
            );
          })}
          {/* Editor de nodos: puntos del path arrastrables. */}
          {ui.pathEditingBlockId && (() => {
            const pb = slide.blocks.find((b) => b.id === ui.pathEditingBlockId);
            if (!pb || pb.content.kind !== 'path') return null;
            return <PathNodeEditor block={pb} slideId={slide.id} format={format} scale={scale * zoom} />;
          })()}
        </svg>
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
      </div>
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
