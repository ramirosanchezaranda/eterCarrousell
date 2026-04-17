/**
 * Thumbnail de plantilla — render SIMPLIFICADO para performance.
 * En vez de ejecutar BlockView (que genera GlitchTexture con 6k+ rects),
 * dibujamos cada bloque como un rect/circulo coloreado según su `kind`.
 * A 80 px no se distingue visualmente y es ~10× más rápido que el preview real.
 */
import { useMemo } from 'react';
import type { PositionedBlock, TemplateMeta, SlideType, BrandTheme } from '@/domain';
import { FORMATS } from '@/formats';

interface Props {
  template: TemplateMeta;
  theme: BrandTheme;
  active: boolean;
  onClick: () => void;
  size?: number;
  previewType?: SlideType;
}

export function TemplateThumb({ template, theme, active, onClick, size = 80, previewType = 'cover' }: Props) {
  const format = FORMATS['ig-4x5'];
  const blocks = useMemo(
    () => template.initBlocks(previewType, format, theme, 42),
    [template, theme, previewType, format],
  );
  const aspect = format.width / format.height;
  const w = size;
  const h = size / aspect;

  return (
    <button
      onClick={onClick}
      title={template.label}
      style={{
        padding: 4,
        background: active ? '#2E46C830' : '#14141E',
        border: `1px solid ${active ? '#2E46C8' : '#F1E8D320'}`,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <svg
        viewBox={`0 0 ${format.width} ${format.height}`}
        width={w}
        height={h}
        style={{ background: theme.colors.bg, borderRadius: 3, display: 'block' }}
      >
        {blocks
          .slice()
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((block) => (
            <ThumbBlock key={block.id} block={block} theme={theme} />
          ))}
      </svg>
      <span style={{ fontSize: 9, color: '#F1E8D3', opacity: active ? 1 : 0.7, textAlign: 'center', lineHeight: 1.2 }}>
        {template.label.split(' / ')[0]}
      </span>
    </button>
  );
}

/** Render ultra liviano de un bloque para miniaturas. */
function ThumbBlock({ block, theme }: { block: PositionedBlock; theme: BrandTheme }) {
  const { rect, content } = block;
  const transform = block.rotation
    ? `rotate(${block.rotation} ${rect.x + rect.w / 2} ${rect.y + rect.h / 2})`
    : undefined;

  if (content.kind === 'text') {
    const barH = rect.h * 0.18;
    const barY = rect.y + rect.h * 0.4;
    const align = content.textAlign;
    const widths = [rect.w * 0.9, rect.w * 0.65];
    return (
      <g transform={transform}>
        {widths.map((bw, i) => {
          const bx = align === 'middle'
            ? rect.x + (rect.w - bw) / 2
            : align === 'end'
            ? rect.x + rect.w - bw
            : rect.x;
          return (
            <rect
              key={i}
              x={bx}
              y={barY + i * barH * 1.4}
              width={bw}
              height={barH}
              fill={content.color}
              opacity={0.7 - i * 0.2}
            />
          );
        })}
      </g>
    );
  }

  if (content.kind === 'shape') {
    const { shape, fill, opacity } = content;
    const f = fill ?? theme.colors.primary;
    if (shape === 'circle') {
      return <ellipse cx={rect.x + rect.w / 2} cy={rect.y + rect.h / 2} rx={rect.w / 2} ry={rect.h / 2} fill={f} opacity={opacity} transform={transform} />;
    }
    return <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={f} opacity={opacity} transform={transform} />;
  }

  if (content.kind === 'image') {
    return <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={theme.colors.primary} opacity={0.55} transform={transform} />;
  }

  if (content.kind === 'decor') {
    if (content.src) {
      return (
        <image
          href={content.src}
          x={rect.x} y={rect.y} width={rect.w} height={rect.h}
          preserveAspectRatio="xMidYMid slice"
          transform={transform}
        />
      );
    }
    return (
      <g transform={transform}>
        <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={theme.colors.primary} opacity={0.85} />
        {content.overlay && (
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={content.overlay.color} opacity={content.overlay.opacity} />
        )}
      </g>
    );
  }

  return null;
}
