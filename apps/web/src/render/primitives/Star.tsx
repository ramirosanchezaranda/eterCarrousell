/**
 * Estrella de N puntas usada como marcador decorativo junto al headline.
 */
interface StarProps {
  cx: number;
  cy: number;
  size: number;
  color: string;
  points?: number;
  innerRatio?: number;
}

export function Star({ cx, cy, size, color, points = 12, innerRatio = 0.45 }: StarProps) {
  const outer = size;
  const inner = size * innerRatio;
  const path: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    path.push(`${i === 0 ? 'M' : 'L'} ${(cx + Math.cos(angle) * r).toFixed(2)} ${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  path.push('Z');
  return <path d={path.join(' ')} fill={color} />;
}
