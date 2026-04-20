/**
 * EditorCanvas — editor tipo Canva sobre SVG.
 *  • Drag / resize / rotate con handles, snap a guides activos.
 *  • Doble click en bloque de texto → edición inline.
 *  • Right click → context menu (Eliminar / Duplicar / Z-order / Lock / Pegar imagen).
 *  • Ctrl+V / drop de archivo / drop desde galería → agrega imagen al slide.
 *  • Render del background del slide (solid / gradient / image) o bg del theme.
 *  • Motor de auto-fix opcional al soltar drag.
 *  • Zoom (Ctrl+Scroll / pinch) y pan (spacebar+drag / scroll sin Ctrl).
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

interface PanDragState {
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

/** Clamp zoom between 25% and 400%. */
function clampZoom(z: number): number {
  return Math.min(4, Math.max(0.25, z));
}

export function EditorCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);
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

  // Spacebar state for pan-by-drag mode.
  const [spaceDown, setSpaceDown] = useState(false);
  const spaceDownRef = useRef(false);

  // Pan drag state (spacebar + pointer drag). Kept in ref for event handlers,
  // mirrored to state only to trigger re-render on start/end (cursor change).
  const panDragRef = useRef<PanDragState | null>(null);
  const [isPanDragging, setIsPanDragging] = useState(false);

  // Pinch gesture tracking (two-finger touch).
  const pinchRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // ─── Zoom / Pan via wheel (Ctrl+scroll = zoom, plain scroll = pan) ───────
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panX, panY } = useUiStore.getState();

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor position.
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        // Smooth exponential zoom: each 100 deltaY units ≈ ±10%
        const factor = Math.pow(1.001, -e.deltaY);
        const newZoom = clampZoom(zoom * factor);
        // Adjust pan so the canvas point under cursor stays fixed.
        const newPanX = cx - (cx - panX) * (newZoom / zoom);
        const newPanY = cy - (cy - panY) * (newZoom / zoom);
        useUiStore.getState().setView(newZoom, newPanX, newPanY);
      } else {
        // Plain scroll → pan the canvas.
        useUiStore.getState().setPan(panX - e.deltaX, panY - e.deltaY);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ─── Spacebar for pan-by-drag ─────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      if (!spaceDownRef.current) {
        spaceDownRef.current = true;
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceDownRef.current = false;
      setSpaceDown(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ─── Touch pinch gesture ──────────────────────────────────────────────────
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const t1 = e.touches[0]!;
      const t2 = e.touches[1]!;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const { zoom, panX, panY } = useUiStore.getState();
      pinchRef.current = {
        dist,
        midX: (t1.clientX + t2.clientX) / 2,
        midY: (t1.clientY + t2.clientY) / 2,
        startZoom: zoom,
        startPanX: panX,
        startPanY: panY,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const t1 = e.touches[0]!;
      const t2 = e.touches[1]!;
      const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const { dist: initDist, midX, midY, startZoom, startPanX, startPanY } = pinchRef.current;
      const rect = el.getBoundingClientRect();
      const cx = midX - rect.left;
      const cy = midY - rect.top;
      const newZoom = clampZoom(startZoom * (curDist / initDist));
      const newPanX = cx - (cx - startPanX) * (newZoom / startZoom);
      const newPanY = cy - (cy - startPanY) * (newZoom / startZoom);
      useUiStore.getState().setView(newZoom, newPanX, newPanY);
    };

    const onTouchEnd = () => { pinchRef.current = null; };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // ─── Canvas coordinate mapping ────────────────────────────────────────────
  // getBoundingClientRect on the SVG already returns the post-transform rect,
  // so this mapping is zoom/pan-aware without any extra math.
  const pointerToCanvas = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vx = (e.clientX - rect.left) / rect.width;
    const vy = (e.clientY - rect.top) / rect.height;
    return { x: vx * format.width, y: vy * format.height };
  }, [format]);

  // ─── Start pan drag helper ────────────────────────────────────────────────
  const startPanDrag = (e: ReactPointerEvent<Element>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const { panX, panY } = useUiStore.getState();
    panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };
    setIsPanDragging(true);
  };

  const onBlockPointerDown = (block: PositionedBlock, e: ReactPointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Spacebar held → pan mode, even over a block.
    if (spaceDownRef.current) { startPanDrag(e); return; }
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
    // Pan drag (spacebar + pointer drag).
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
    // End pan drag.
    if (panDragRef.current) {
      panDragRef.current = null;
      setIsPanDragging(false);
      return;
    }
    if (!drag || !slide) { setDrag(null); return; }
    const patch = drag.mode === 'rotate'
      ? { rotation: drag.currentRotation }
      : { rect: drag.currentRect };
    projectStore.updateBlock(slide.id, drag.blockId, patch);
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
    if (spaceDownRef.current) { startPanDrag(e); return; }
    ui.clearSelection();
  };

  const onDrop = async (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!slide) return;
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

  const containerStyle = useMemo(() => ({
    maxWidth: 560,
    margin: '0 auto',
    boxShadow: '0 30px 80px rgba(46, 70, 200, 0.3)',
    borderRadius: 8,
    overflow: 'hidden',
    background: assets.theme.colors.bg,
    position: 'relative' as const,
    cursor: spaceDown ? (isPanDragging ? 'grabbing' : 'grab') : undefined,
  }), [assets.theme.colors.bg, spaceDown, isPanDragging]);

  if (!slide) {
    return (
      <div style={{ ...containerStyle, aspectRatio: `${format.width} / ${format.height}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', padding: 40, textAlign: 'center' }}>
        Elegí una plantilla del panel izquierdo para empezar.
      </div>
    );
  }

  // Natural scale (zoom=1): canvas units → screen pixels.
  const scale = canvasWidthPx / format.width;
  // Visual scale including zoom: used by SelectionHandles to keep handles at fixed px size.
  const visualScale = scale * ui.zoom;

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
      ref={(el) => {
        outerRef.current = el;
        if (el) setCanvasWidthPx(el.clientWidth);
      }}
      style={containerStyle}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onContextMenu={onCanvasContextMenu}
    >
      {/* Zoom / pan transform wrapper. transform-origin at top-left so pan math is simple. */}
      <div
        style={{
          transformOrigin: '0 0',
          transform: `translate(${ui.panX}px, ${ui.panY}px) scale(${ui.zoom})`,
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
              const live = drag && drag.blockId === block.id
                ? { ...block, rect: drag.currentRect, rotation: drag.currentRotation }
                : block;
              return (
                <g
                  key={block.id}
                  onPointerDown={(e) => onBlockPointerDown(block, e)}
                  onDoubleClick={() => onBlockDoubleClick(block)}
                  onContextMenu={(e) => onBlockContextMenu(block, e as unknown as React.MouseEvent)}
                  style={{ cursor: spaceDown ? undefined : block.locked ? 'default' : 'move', opacity: editing === block.id ? 0 : 1 }}
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
            if (ui.pathEditingBlockId === b.id && b.content.kind === 'path') return null;
            const liveRect = drag && drag.blockId === b.id ? drag.currentRect : b.rect;
            return (
              <SelectionHandles
                key={id}
                rect={liveRect}
                scale={visualScale}
                onHandleDown={(h, ev) => onHandleDown(b, h, ev)}
              />
            );
          })}
          {ui.pathEditingBlockId && (() => {
            const pb = slide.blocks.find((b) => b.id === ui.pathEditingBlockId);
            if (!pb || pb.content.kind !== 'path') return null;
            return <PathNodeEditor block={pb} slideId={slide.id} format={format} />;
          })()}
        </svg>
        {/* InlineTextEditor lives inside the zoom wrapper so it scales automatically. */}
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
