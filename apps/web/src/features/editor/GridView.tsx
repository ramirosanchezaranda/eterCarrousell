/**
 * Vista grid de todas las slides del carrusel — modal fullscreen.
 * Click en un thumbnail navega a esa slide y cierra el modal.
 * Cada thumbnail renderiza un `<svg>` real del slide (mini-canvas) con
 * todos los bloques y fondos, escalado proporcional al aspect-ratio del
 * format.
 */
import { X } from 'lucide-react';
import { BRAND, type SlideBackground } from '@/domain';
import type { EditableSlide } from '@/domain';
import { FORMATS } from '@/formats';
import { BlockView } from '@/render/BlockView';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';
import { useAssetsStore } from '@/state/assetsStore';

export function GridView() {
  const open = useUiStore((s) => s.gridViewOpen);
  const close = useUiStore((s) => s.setGridViewOpen);
  const project = useProjectStore();
  const assets = useAssetsStore();
  const format = FORMATS[project.formatId];

  if (!open) return null;

  const onPick = (slide: EditableSlide) => {
    project.setCurrentSlideId(slide.id);
    close(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Todas las páginas"
      onClick={() => close(false)}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8, 8, 14, 0.92)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        padding: 24,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, color: BRAND.cream,
      }}>
        <strong style={{ fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
          Todas las páginas · {project.slides.length}
        </strong>
        <button
          onClick={() => close(false)}
          aria-label="Cerrar"
          style={{
            background: 'transparent', border: 'none', color: BRAND.cream,
            padding: 6, cursor: 'pointer', display: 'flex',
          }}
        >
          <X size={20} />
        </button>
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
          overflow: 'auto',
          flex: 1,
          paddingBottom: 24,
        }}
      >
        {project.slides.map((slide, i) => {
          const isCurrent = slide.id === project.currentSlideId;
          const bg: SlideBackground = slide.background ?? { kind: 'solid', color: assets.theme.colors.bg };
          return (
            <button
              key={slide.id}
              onClick={() => onPick(slide)}
              style={{
                position: 'relative',
                background: assets.theme.colors.bg,
                border: `2px solid ${isCurrent ? BRAND.blue : BRAND.cream + '22'}`,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                padding: 0,
                boxShadow: isCurrent ? `0 8px 28px ${BRAND.blue}60` : '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'transform 120ms ease, border-color 120ms ease',
              }}
            >
              <svg
                viewBox={`0 0 ${format.width} ${format.height}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' }}
              >
                <SlideBgRender bg={bg} width={format.width} height={format.height} />
                {slide.blocks
                  .slice()
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map((block) => (
                    <BlockView
                      key={block.id}
                      block={block}
                      theme={assets.theme}
                      fonts={assets.theme.fonts}
                      seed={slide.seed ?? 0}
                    />
                  ))}
              </svg>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '6px 10px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                color: BRAND.cream, fontSize: 11, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontFamily: 'monospace', opacity: 0.9 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {slide.type}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Render mínimo del background del slide para el thumbnail, sin
 * importar primitivos complejos. Sólo solid / gradient / image (sin filtros).
 */
function SlideBgRender({ bg, width, height }: { bg: SlideBackground; width: number; height: number }) {
  if (bg.kind === 'solid') {
    return <rect width={width} height={height} fill={bg.color} />;
  }
  if (bg.kind === 'gradient') {
    const id = `gv-grad-${Math.round(bg.angle)}`;
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
  const fit = bg.fit === 'contain' ? 'xMidYMid meet' : bg.fit === 'cover' ? 'xMidYMid slice' : 'none';
  return (
    <g opacity={bg.opacity ?? 1}>
      {bg.src && <image href={bg.src} x={0} y={0} width={width} height={height} preserveAspectRatio={fit} />}
    </g>
  );
}
