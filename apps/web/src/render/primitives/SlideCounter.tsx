/**
 * Contador de slide (ej: `02 / 06`) posicionado en la esquina superior derecha.
 */
import { SAFE } from '@/domain';

interface SlideCounterProps {
  index: number;
  total: number;
  color: string;
  mono: string;
}

export function SlideCounter({ index, total, color, mono }: SlideCounterProps) {
  return (
    <g transform={`translate(${SAFE.right - 100}, ${SAFE.top + 12})`}>
      <text fontFamily={mono} fontSize={14} fill={color} opacity={0.55} letterSpacing="2">
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </text>
    </g>
  );
}
