/**
 * Handles de selección para un bloque: 8 controles de resize (corners + edges)
 * + handle de rotación "tab Canva-style" ABAJO del rect. Se dibujan en
 * coordenadas del canvas SVG y el click/drag se captura en el EditorCanvas
 * padre vía pointer events.
 *
 * El rotation handle:
 *   - Círculo grande (18px) con icono ↻ dentro para que sea inequívoco
 *   - Colgado de una línea desde el borde inferior (imitando Canva/Figma)
 *   - Cursor 'grab' / 'grabbing' y shadow sutil para destacarse sobre
 *     cualquier background del canvas
 */
import type { Rect } from '@/domain';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

interface Props {
  rect: Rect;
  onHandleDown: (handle: HandlePosition, ev: React.PointerEvent<SVGElement>) => void;
  scale: number;
}

export function SelectionHandles({ rect, onHandleDown, scale }: Props) {
  const hs = 14 / scale;              // handle size (resize) en unidades de canvas
  const rotR = 13 / scale;            // radio del círculo del rotation handle
  const stroke = 2 / scale;
  const rotOffset = 44 / scale;       // distancia del rotation handle al borde
  const cx = rect.x + rect.w / 2;
  const cyBottom = rect.y + rect.h + rotOffset;

  const positions: Array<{ key: HandlePosition; x: number; y: number; cursor: string }> = [
    { key: 'nw', x: rect.x,               y: rect.y,               cursor: 'nwse-resize' },
    { key: 'n',  x: rect.x + rect.w / 2,  y: rect.y,               cursor: 'ns-resize' },
    { key: 'ne', x: rect.x + rect.w,      y: rect.y,               cursor: 'nesw-resize' },
    { key: 'e',  x: rect.x + rect.w,      y: rect.y + rect.h / 2,  cursor: 'ew-resize' },
    { key: 'se', x: rect.x + rect.w,      y: rect.y + rect.h,      cursor: 'nwse-resize' },
    { key: 's',  x: rect.x + rect.w / 2,  y: rect.y + rect.h,      cursor: 'ns-resize' },
    { key: 'sw', x: rect.x,               y: rect.y + rect.h,      cursor: 'nesw-resize' },
    { key: 'w',  x: rect.x,               y: rect.y + rect.h / 2,  cursor: 'ew-resize' },
  ];

  return (
    <g style={{ pointerEvents: 'auto' }}>
      {/* Marco punteado del bbox */}
      <rect
        x={rect.x} y={rect.y} width={rect.w} height={rect.h}
        fill="none" stroke="#2E46C8" strokeWidth={stroke} strokeDasharray={`${4 / scale} ${4 / scale}`}
        pointerEvents="none"
      />
      {/* Línea que conecta el rect con el rotation tab — Canva lo pone abajo */}
      <line
        x1={cx} y1={rect.y + rect.h}
        x2={cx} y2={cyBottom}
        stroke="#2E46C8" strokeWidth={stroke} pointerEvents="none"
      />
      {/* Rotation tab: círculo cream con ring azul + icono ↻ */}
      <RotationHandle
        cx={cx}
        cy={cyBottom}
        r={rotR}
        stroke={stroke}
        onPointerDown={(e) => onHandleDown('rotate', e)}
      />
      {/* Resize handles (8 cuadrados en los bordes) */}
      {positions.map((p) => (
        <rect
          key={p.key}
          x={p.x - hs / 2} y={p.y - hs / 2}
          width={hs} height={hs}
          fill="#F1E8D3" stroke="#2E46C8" strokeWidth={stroke}
          style={{ cursor: p.cursor }}
          onPointerDown={(e) => onHandleDown(p.key, e)}
        />
      ))}
    </g>
  );
}

/**
 * Handle de rotación estilo Canva: círculo cream con anillo azul + icono
 * de flecha circular adentro. Un `<g>` con shadow sutil para que se vea
 * contrastado incluso encima de fondos claros o con mucha textura.
 */
function RotationHandle({
  cx, cy, r, stroke, onPointerDown,
}: {
  cx: number; cy: number; r: number; stroke: number;
  onPointerDown: (e: React.PointerEvent<SVGElement>) => void;
}) {
  // Icono ↻ dibujado a escala con un arco + flecha. Coords relativas al
  // centro (cx, cy). Radio del arco ≈ 0.55·r para que quede aireado
  // dentro del círculo.
  const ar = r * 0.55;
  // Arco desde ~30° a ~300° (gira en sentido horario). Flecha al final.
  const a1 = 0.3;        // ángulo inicial (rad)
  const a2 = Math.PI * 1.6; // ángulo final (rad)
  const x1 = cx + Math.cos(a1) * ar;
  const y1 = cy + Math.sin(a1) * ar;
  const x2 = cx + Math.cos(a2) * ar;
  const y2 = cy + Math.sin(a2) * ar;
  const largeArc = 1;
  const arcPath = `M ${x1} ${y1} A ${ar} ${ar} 0 ${largeArc} 0 ${x2} ${y2}`;
  // Punta de flecha en el extremo (x2,y2), apuntando hacia afuera del arco
  const tipLen = r * 0.32;
  const tipAngle = a2 - Math.PI / 2;
  const tip1x = x2 + Math.cos(tipAngle - 0.5) * tipLen;
  const tip1y = y2 + Math.sin(tipAngle - 0.5) * tipLen;
  const tip2x = x2 + Math.cos(tipAngle + 0.5) * tipLen;
  const tip2y = y2 + Math.sin(tipAngle + 0.5) * tipLen;
  const arrowPath = `M ${x2} ${y2} L ${tip1x} ${tip1y} M ${x2} ${y2} L ${tip2x} ${tip2y}`;
  return (
    <g style={{ cursor: 'grab' }} onPointerDown={onPointerDown}>
      {/* Shadow sutil para destacar sobre cualquier fondo */}
      <circle cx={cx} cy={cy + stroke * 0.8} r={r} fill="#0A0A14" opacity={0.25} />
      {/* Círculo principal */}
      <circle cx={cx} cy={cy} r={r} fill="#F1E8D3" stroke="#2E46C8" strokeWidth={stroke * 1.2} />
      {/* Icono rotate ↻ */}
      <path d={arcPath} fill="none" stroke="#2E46C8" strokeWidth={stroke * 1.1} strokeLinecap="round" />
      <path d={arrowPath} fill="none" stroke="#2E46C8" strokeWidth={stroke * 1.1} strokeLinecap="round" />
    </g>
  );
}
