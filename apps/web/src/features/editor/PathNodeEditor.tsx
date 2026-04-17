/**
 * Editor de nodos de un PathContent — MVP al estilo "Pen tool" de Illustrator.
 * Muestra un handle SVG en cada punto absoluto del `d` (comandos M/L/C/Q)
 * encima del canvas. Click+drag de un handle mueve ese punto específico.
 *
 * Soporta:
 *   - Mover puntos absolutos: M/L target, C target + 2 controls, Q target + 1 control.
 *   - Respeta los comandos relativos convirtiéndolos primero a absolutos al parsear.
 *
 * Limitaciones declaradas (no es Illustrator completo):
 *   - No insertar/borrar nodos (add/delete).
 *   - No cambiar el tipo de nodo (cusp/smooth/symmetric).
 *   - Los handles de Bézier se muestran pero no se distinguen del punto ancla.
 *   - No hay Pen tool para dibujar desde cero.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PositionedBlock, SlideFormat } from '@/domain';
import { useProjectStore } from '@/state/projectStore';

interface Props {
  block: PositionedBlock;
  slideId: string;
  format: SlideFormat;
}

interface EditablePoint {
  id: string;
  x: number;
  y: number;
  segmentIdx: number;
  pointRole: 'anchor' | 'control';
}

interface ParsedSegment {
  command: string;         // absoluto (M, L, C, Q, Z)
  args: number[];
}

export function PathNodeEditor({ block, slideId, format }: Props) {
  const update = useProjectStore((s) => s.updateBlock);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ segIdx: number; argOffset: number; startPointer: { x: number; y: number } } | null>(null);

  // Sacamos `d` de forma type-safe antes de cualquier hook adicional.
  const pathD = block.content.kind === 'path' ? block.content.d : '';
  const segments = useMemo(() => parsePath(pathD), [pathD]);
  const points = useMemo(() => collectPoints(segments), [segments]);
  if (block.content.kind !== 'path') return null;

  // Mapear pointer del viewport al espacio del canvas SVG del editor.
  const pointerToCanvas = useCallback((e: { clientX: number; clientY: number }) => {
    // El handle está dentro del SVG del canvas (mismo viewBox 0 0 W H).
    const svg = svgRef.current?.ownerSVGElement ?? svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * format.width,
      y: ((e.clientY - rect.top) / rect.height) * format.height,
    };
  }, [format]);

  const onPointerDown = (p: EditablePoint, argOffset: number) => (e: React.PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({
      segIdx: p.segmentIdx,
      argOffset,
      startPointer: pointerToCanvas(e),
    });
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || block.content.kind !== 'path') return;
    const p = pointerToCanvas(e);
    const segs = parsePath(block.content.d);
    const target = segs[drag.segIdx];
    if (!target) return;
    // Reemplaza los dos args (x, y) en argOffset
    target.args[drag.argOffset] = p.x;
    target.args[drag.argOffset + 1] = p.y;
    const newD = serializePath(segs);
    update(slideId, block.id, {
      content: { ...block.content, d: newD } as PositionedBlock['content'],
    });
  };

  const onPointerUp = () => setDrag(null);

  return (
    <g
      ref={(el) => { svgRef.current = el as unknown as SVGSVGElement | null; }}
      style={{ pointerEvents: 'auto' }}
      onPointerMove={onPointerMove as unknown as React.PointerEventHandler<SVGGElement>}
      onPointerUp={onPointerUp}
    >
      {points.map((p) => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={p.pointRole === 'anchor' ? 7 : 5}
          fill={p.pointRole === 'anchor' ? '#F1E8D3' : 'transparent'}
          stroke="#2E46C8"
          strokeWidth={2}
          style={{ cursor: 'grab' }}
          onPointerDown={onPointerDown(p, p.pointRole === 'anchor'
            ? argOffsetForAnchor(segments[p.segmentIdx]!)
            : argOffsetForControl(segments[p.segmentIdx]!, p))}
        />
      ))}
    </g>
  );
}

// ============================================================
// Parser / serializer de `d`
// ============================================================

function parsePath(d: string): ParsedSegment[] {
  // Parser simple pero robusto para los comandos que emite opentype.js:
  // M, L, C, Q, Z (y sus variantes en minúscula las normalizamos a absolutas).
  const tokens = d.match(/([MLCQZmlcqz])|(-?\d*\.?\d+(?:e-?\d+)?)/g) ?? [];
  const segments: ParsedSegment[] = [];
  let i = 0;
  let cx = 0, cy = 0;          // "current point" para convertir relativos a absolutos
  let startX = 0, startY = 0;  // punto de inicio de subpath para Z
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (!/[MLCQZmlcqz]/.test(t)) { i++; continue; }
    const cmdRaw = t;
    const abs = cmdRaw.toUpperCase();
    i++;
    const readNum = () => Number(tokens[i++]);
    switch (abs) {
      case 'M': {
        let x = readNum(), y = readNum();
        if (cmdRaw === 'm') { x += cx; y += cy; }
        cx = x; cy = y; startX = x; startY = y;
        segments.push({ command: 'M', args: [x, y] });
        // extra coords después de M son "L implícito"
        while (i < tokens.length && /^-?\d/.test(tokens[i]!)) {
          let lx = readNum(), ly = readNum();
          if (cmdRaw === 'm') { lx += cx; ly += cy; }
          cx = lx; cy = ly;
          segments.push({ command: 'L', args: [lx, ly] });
        }
        break;
      }
      case 'L': {
        while (i < tokens.length && /^-?\d/.test(tokens[i]!)) {
          let x = readNum(), y = readNum();
          if (cmdRaw === 'l') { x += cx; y += cy; }
          cx = x; cy = y;
          segments.push({ command: 'L', args: [x, y] });
        }
        break;
      }
      case 'C': {
        while (i < tokens.length && /^-?\d/.test(tokens[i]!)) {
          let x1 = readNum(), y1 = readNum();
          let x2 = readNum(), y2 = readNum();
          let x = readNum(), y = readNum();
          if (cmdRaw === 'c') {
            x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy;
          }
          cx = x; cy = y;
          segments.push({ command: 'C', args: [x1, y1, x2, y2, x, y] });
        }
        break;
      }
      case 'Q': {
        while (i < tokens.length && /^-?\d/.test(tokens[i]!)) {
          let x1 = readNum(), y1 = readNum();
          let x = readNum(), y = readNum();
          if (cmdRaw === 'q') {
            x1 += cx; y1 += cy; x += cx; y += cy;
          }
          cx = x; cy = y;
          segments.push({ command: 'Q', args: [x1, y1, x, y] });
        }
        break;
      }
      case 'Z':
        segments.push({ command: 'Z', args: [] });
        cx = startX; cy = startY;
        break;
    }
  }
  return segments;
}

function serializePath(segments: ParsedSegment[]): string {
  return segments
    .map((s) => s.command + (s.args.length ? s.args.map((n) => round(n)).join(' ') : ''))
    .join(' ');
}

function round(n: number): string {
  return Math.abs(n - Math.round(n)) < 1e-3 ? String(Math.round(n)) : n.toFixed(2);
}

function collectPoints(segments: ParsedSegment[]): EditablePoint[] {
  const points: EditablePoint[] = [];
  segments.forEach((s, idx) => {
    switch (s.command) {
      case 'M':
      case 'L': {
        points.push({ id: `${idx}-anchor`, x: s.args[0]!, y: s.args[1]!, segmentIdx: idx, pointRole: 'anchor' });
        break;
      }
      case 'C': {
        points.push({ id: `${idx}-c1`, x: s.args[0]!, y: s.args[1]!, segmentIdx: idx, pointRole: 'control' });
        points.push({ id: `${idx}-c2`, x: s.args[2]!, y: s.args[3]!, segmentIdx: idx, pointRole: 'control' });
        points.push({ id: `${idx}-anchor`, x: s.args[4]!, y: s.args[5]!, segmentIdx: idx, pointRole: 'anchor' });
        break;
      }
      case 'Q': {
        points.push({ id: `${idx}-c1`, x: s.args[0]!, y: s.args[1]!, segmentIdx: idx, pointRole: 'control' });
        points.push({ id: `${idx}-anchor`, x: s.args[2]!, y: s.args[3]!, segmentIdx: idx, pointRole: 'anchor' });
        break;
      }
    }
  });
  return points;
}

function argOffsetForAnchor(seg: ParsedSegment): number {
  if (seg.command === 'C') return 4;   // x, y de target en posiciones 4,5
  if (seg.command === 'Q') return 2;   // 2,3
  return 0;                             // M/L: 0,1
}

function argOffsetForControl(seg: ParsedSegment, p: EditablePoint): number {
  if (seg.command === 'C') return p.id.endsWith('-c1') ? 0 : 2;
  if (seg.command === 'Q') return 0;
  return 0;
}
