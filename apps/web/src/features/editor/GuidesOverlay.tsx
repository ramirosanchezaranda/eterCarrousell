/**
 * Renderiza los guides visuales activos como overlay SVG sobre el canvas.
 * No se exporta al JPEG/PNG final.
 *
 * Visibilidad:
 *   - `defaultGuideOpacity` (store) se aplica como multiplicador sobre la
 *     opacity intrínseca de cada línea (algunas tienen 0.3 para ser sutiles).
 *     Subimos la default a 0.85 porque la histórica de 0.5 era demasiado
 *     tenue sobre fondos claros y el usuario reportó que no se veían.
 *   - `guideOpacity[id]` (store) permite override per-guide via slider en
 *     el panel lateral.
 *   - `guideStrokeMultiplier` engrosa las líneas globalmente (útil para
 *     presentaciones o cuando se proyecta el editor).
 */
import type { EditorGuide, GuideLine, SlideFormat } from '@/domain';
import { GUIDES } from '@/guides';
import { useUiStore } from '@/state/uiStore';

interface Props {
  format: SlideFormat;
  activeGuideIds: readonly string[];
  color?: string;
}

export function GuidesOverlay({ format, activeGuideIds, color = '#2E46C8' }: Props) {
  const guideOpacity = useUiStore((s) => s.guideOpacity);
  const defaultOpacity = useUiStore((s) => s.defaultGuideOpacity);
  const strokeMultiplier = useUiStore((s) => s.guideStrokeMultiplier);
  return (
    <g style={{ pointerEvents: 'none' }}>
      {activeGuideIds.map((id) => {
        const guide = GUIDES[id as keyof typeof GUIDES];
        if (!guide) return null;
        const override = guideOpacity[id as keyof typeof guideOpacity];
        const groupOpacity = override ?? defaultOpacity;
        return (
          <GuideLines
            key={id}
            guide={guide}
            format={format}
            color={color}
            groupOpacity={groupOpacity}
            strokeMultiplier={strokeMultiplier}
          />
        );
      })}
    </g>
  );
}

function GuideLines({
  guide, format, color, groupOpacity, strokeMultiplier,
}: {
  guide: EditorGuide;
  format: SlideFormat;
  color: string;
  groupOpacity: number;
  strokeMultiplier: number;
}) {
  const lines = guide.renderLines(format);
  return (
    <g stroke={color} fill="none" strokeDasharray="6 6" opacity={groupOpacity}>
      {lines.map((ln, i) => (
        <GuideShape key={i} line={ln} color={color} strokeMultiplier={strokeMultiplier} />
      ))}
    </g>
  );
}

function GuideShape({
  line, color, strokeMultiplier,
}: { line: GuideLine; color: string; strokeMultiplier: number }) {
  const op = line.opacity ?? 1;
  const sw2 = 2 * strokeMultiplier;
  const sw15 = 1.5 * strokeMultiplier;
  switch (line.kind) {
    case 'line':   return <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} strokeWidth={sw2} opacity={op} />;
    case 'rect':   return <rect x={line.x} y={line.y} width={line.w} height={line.h} strokeWidth={sw15} opacity={op} />;
    case 'circle': return <circle cx={line.cx} cy={line.cy} r={line.r} strokeWidth={sw15} opacity={op} />;
    case 'path':   return <path d={line.d} stroke={color} strokeWidth={sw2} opacity={op} fill="none" />;
  }
}
