/**
 * Renderiza los guides visuales activos como overlay SVG sobre el canvas.
 * No se exporta al JPEG/PNG final.
 */
import type { EditorGuide, GuideLine, SlideFormat } from '@/domain';
import { GUIDES } from '@/guides';

interface Props {
  format: SlideFormat;
  activeGuideIds: readonly string[];
  color?: string;
}

export function GuidesOverlay({ format, activeGuideIds, color = '#2E46C8' }: Props) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {activeGuideIds.map((id) => {
        const guide = GUIDES[id as keyof typeof GUIDES];
        if (!guide) return null;
        return <GuideLines key={id} guide={guide} format={format} color={color} />;
      })}
    </g>
  );
}

function GuideLines({ guide, format, color }: { guide: EditorGuide; format: SlideFormat; color: string }) {
  const lines = guide.renderLines(format);
  return (
    <g stroke={color} fill="none" strokeDasharray="6 6">
      {lines.map((ln, i) => <GuideShape key={i} line={ln} color={color} />)}
    </g>
  );
}

function GuideShape({ line, color }: { line: GuideLine; color: string }) {
  const op = line.opacity ?? 0.5;
  switch (line.kind) {
    case 'line':   return <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} strokeWidth={2} opacity={op} />;
    case 'rect':   return <rect x={line.x} y={line.y} width={line.w} height={line.h} strokeWidth={1.5} opacity={op} />;
    case 'circle': return <circle cx={line.cx} cy={line.cy} r={line.r} strokeWidth={1.5} opacity={op} />;
    case 'path':   return <path d={line.d} stroke={color} strokeWidth={2} opacity={op} fill="none" />;
  }
}
