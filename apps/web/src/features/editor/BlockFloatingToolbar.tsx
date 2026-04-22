/**
 * Toolbar flotante tipo Canva que aparece pegado al bloque seleccionado.
 * Muestra acciones rápidas contextuales según el tipo de bloque:
 *   - Todos:      Duplicar, Lock, Trash, subir/bajar z-order
 *   - Texto:      Bold, Italic, Underline, Color
 *   - Imagen:     Reemplazar
 *   - Shape:      Color de fill rápido
 *
 * Se posiciona con `position: absolute` dentro del container del canvas
 * (el mismo que hospeda el SVG). Se calcula en coordenadas de pantalla a
 * partir del `block.rect` y el scale actual del canvas. Por encima del
 * bbox si hay espacio, abajo si el bbox está cerca del top.
 */
import { useRef } from 'react';
import {
  Bold, Copy, Italic, Lock, Unlock, Palette, Trash2, Underline,
  ArrowUp, ArrowDown, Image as ImageIcon,
} from 'lucide-react';
import type { PositionedBlock, Rect } from '@/domain';
import { BRAND } from '@/domain';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';

interface Props {
  block: PositionedBlock;
  slideId: string;
  /**
   * Escala px/unidad-canvas en PANTALLA, ya multiplicada por el zoom interno
   * del viewBox. Usar directamente para convertir rect del bloque a píxeles.
   */
  scale: number;
  /** Offset del viewBox (pan). Lo que está en `block.rect` está en coords
   *  absolutas del slide, pero el canvas muestra un viewBox desplazado, así
   *  que hay que restar panX/panY antes de aplicar el scale. */
  panX: number;
  panY: number;
  /** Rect "en vivo" durante un drag/resize; si hay, sobrescribe block.rect */
  liveRect?: Rect;
}

const TOOLBAR_HEIGHT = 36;   // altura aproximada del toolbar en px (para ubicarlo encima)
const GAP = 12;              // distancia entre el toolbar y el bbox

export function BlockFloatingToolbar({ block, slideId, scale, panX, panY, liveRect }: Props) {
  const update = useProjectStore((s) => s.updateBlock);
  const remove = useProjectStore((s) => s.removeBlock);
  const duplicate = useProjectStore((s) => s.duplicateBlock);
  const toggleLock = useProjectStore((s) => s.toggleLock);
  const bringForward = useProjectStore((s) => s.bringForward);
  const sendBackward = useProjectStore((s) => s.sendBackward);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const setSelectedBlockIds = useUiStore((s) => s.setSelectedBlockIds);
  const fileRef = useRef<HTMLInputElement>(null);

  const rect = liveRect ?? block.rect;
  // Coordenadas del bbox en px de pantalla — restamos el pan del viewBox
  // porque el rect del bloque está en coords absolutas del slide y el canvas
  // muestra una ventana desplazada de él.
  const bboxLeftPx   = (rect.x - panX) * scale;
  const bboxTopPx    = (rect.y - panY) * scale;
  const bboxWidthPx  = rect.w * scale;

  // Intentá poner el toolbar arriba del bbox. Si quedaría con top < 0
  // (bbox muy pegado al borde superior), lo ponemos abajo.
  const aboveTop = bboxTopPx - TOOLBAR_HEIGHT - GAP;
  const showAbove = aboveTop >= 4;
  const toolbarTopPx = showAbove
    ? aboveTop
    : bboxTopPx + (rect.h * scale) + GAP;
  // Centrado horizontal sobre el bbox.
  const toolbarLeftPx = bboxLeftPx + bboxWidthPx / 2;

  const isText  = block.content.kind === 'text';
  const isImage = block.content.kind === 'image';
  const isShape = block.content.kind === 'shape';

  const patchTextProp = (k: string, v: unknown) => {
    if (block.content.kind !== 'text') return;
    update(slideId, block.id, { content: { ...block.content, [k]: v } as PositionedBlock['content'] });
  };

  const handleDuplicate = () => {
    const newId = duplicate(slideId, block.id);
    if (newId) setSelectedBlockIds([newId]);
  };
  const handleDelete = () => {
    remove(slideId, block.id);
    clearSelection();
  };

  const onPickImage = async (file: File) => {
    const dataURI = await fileToDataURI(file);
    if (block.content.kind === 'image') {
      update(slideId, block.id, {
        content: { ...block.content, src: dataURI } as PositionedBlock['content'],
      });
    } else {
      // Si era shape/decor/texto, lo convertimos a image manteniendo el rect.
      update(slideId, block.id, {
        content: { kind: 'image', src: dataURI, fit: 'cover' } as PositionedBlock['content'],
      });
    }
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: toolbarLeftPx,
        top: toolbarTopPx,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        background: '#14141E',
        border: `1px solid ${BRAND.blue}80`,
        borderRadius: 8,
        boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
        zIndex: 50,
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {isText && block.content.kind === 'text' && (
        <>
          <ToolBtn
            title="Bold (Ctrl+B)"
            active={(block.content.fontWeight ?? 400) >= 600}
            onClick={() => patchTextProp('fontWeight', (block.content.kind === 'text' && (block.content.fontWeight ?? 400) >= 600) ? 400 : 700)}
          >
            <Bold size={13} />
          </ToolBtn>
          <ToolBtn
            title="Italic (Ctrl+I)"
            active={block.content.fontStyle === 'italic'}
            onClick={() => patchTextProp('fontStyle', block.content.kind === 'text' && block.content.fontStyle === 'italic' ? 'normal' : 'italic')}
          >
            <Italic size={13} />
          </ToolBtn>
          <ToolBtn
            title="Subrayar (Ctrl+U)"
            active={!!(block.content.kind === 'text' && block.content.underline)}
            onClick={() => patchTextProp('underline', !(block.content.kind === 'text' && block.content.underline))}
          >
            <Underline size={13} />
          </ToolBtn>
          <ColorPickerBtn
            color={block.content.color}
            title="Color del texto"
            onChange={(v) => patchTextProp('color', v)}
          />
          <Divider />
        </>
      )}
      {isShape && block.content.kind === 'shape' && (
        <>
          <ColorPickerBtn
            color={block.content.fill ?? '#000000'}
            title="Relleno"
            onChange={(v) => {
              if (block.content.kind !== 'shape') return;
              update(slideId, block.id, { content: { ...block.content, fill: v } as PositionedBlock['content'] });
            }}
          />
          <Divider />
        </>
      )}
      {isImage && (
        <>
          <ToolBtn title="Reemplazar imagen" onClick={() => fileRef.current?.click()}>
            <ImageIcon size={13} />
          </ToolBtn>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickImage(f);
              e.target.value = '';
            }}
          />
          <Divider />
        </>
      )}
      <ToolBtn title="Traer al frente" onClick={() => bringForward(slideId, block.id)}>
        <ArrowUp size={13} />
      </ToolBtn>
      <ToolBtn title="Enviar atrás" onClick={() => sendBackward(slideId, block.id)}>
        <ArrowDown size={13} />
      </ToolBtn>
      <ToolBtn title={block.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => toggleLock(slideId, block.id)}>
        {block.locked ? <Lock size={13} /> : <Unlock size={13} />}
      </ToolBtn>
      <ToolBtn title="Duplicar (Ctrl+D)" onClick={handleDuplicate}>
        <Copy size={13} />
      </ToolBtn>
      <ToolBtn title="Eliminar (Del)" onClick={handleDelete} danger>
        <Trash2 size={13} />
      </ToolBtn>
    </div>
  );
}

function ToolBtn({
  children, onClick, title, active, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
}) {
  const color = danger ? '#FF6B6B' : BRAND.cream;
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28, height: 28,
        background: active ? `${BRAND.blue}60` : 'transparent',
        border: `1px solid ${active ? BRAND.blue : 'transparent'}`,
        borderRadius: 4,
        color,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function ColorPickerBtn({
  color, title, onChange,
}: {
  color: string; title: string; onChange: (v: string) => void;
}) {
  return (
    <label
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28, height: 28,
        cursor: 'pointer',
        borderRadius: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 18, height: 18,
          borderRadius: 3,
          background: color,
          border: `1px solid ${BRAND.cream}40`,
        }}
      >
        <Palette size={8} style={{ position: 'absolute', top: 4, right: 4, color: BRAND.cream, opacity: 0.6 }} />
      </span>
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'auto', inset: 0, cursor: 'pointer' }}
      />
    </label>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: `${BRAND.cream}20`, margin: '0 3px' }} />;
}

function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}
