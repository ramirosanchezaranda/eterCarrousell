/**
 * Handles de selección para un bloque: 8 controles de resize (corners + edges)
 * + handle de rotación arriba. Se dibujan en coordenadas del canvas SVG,
 * el click/drag se captura en el EditorCanvas padre vía pointer events.
 */
import type { Rect } from '@/domain';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

interface Props {
  rect: Rect;
  onHandleDown: (handle: HandlePosition, ev: React.PointerEvent<SVGElement>) => void;
  scale: number;
}

export function SelectionHandles({ rect, onHandleDown, scale }: Props) {
  const hs = 14 / scale;         // handle size in canvas units
  const stroke = 2 / scale;
  const rotOffset = 36 / scale;
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
      <rect
        x={rect.x} y={rect.y} width={rect.w} height={rect.h}
        fill="none" stroke="#2E46C8" strokeWidth={stroke} strokeDasharray={`${4 / scale} ${4 / scale}`}
        pointerEvents="none"
      />
      <line
        x1={rect.x + rect.w / 2} y1={rect.y}
        x2={rect.x + rect.w / 2} y2={rect.y - rotOffset}
        stroke="#2E46C8" strokeWidth={stroke} pointerEvents="none"
      />
      <circle
        cx={rect.x + rect.w / 2}
        cy={rect.y - rotOffset}
        r={hs / 2}
        fill="#F1E8D3" stroke="#2E46C8" strokeWidth={stroke}
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => onHandleDown('rotate', e)}
      />
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
