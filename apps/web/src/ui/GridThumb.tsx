/**
 * Miniatura que representa un preset de grilla con los bloques principales
 * (decor, overlay, accent, líneas de texto, logo). Consume un `LegacyLayout`
 * inyectado por el caller — no llama a `getLayout` para evitar acoplarse al
 * motor viejo. En el paso 8 el caller pasa el resultado del motor nuevo.
 */
import { BRAND, CANVAS } from '@/domain';
import type { LegacyLayout, TemplateId } from '@/domain';

interface GridThumbProps {
  preset: TemplateId;
  layout: LegacyLayout;
  active: boolean;
  onClick: () => void;
}

const THUMB_W = 64;
const THUMB_H = 80;
const SCALE = THUMB_W / CANVAS.W;

export function GridThumb({ preset, layout: L, active, onClick }: GridThumbProps) {
  const decor = L.decorRect;
  return (
    <button
      onClick={onClick}
      style={{
        padding: 6,
        background: active ? `${BRAND.blue}25` : '#14141E',
        border: `1px solid ${active ? BRAND.blue : BRAND.cream + '15'}`,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: 'center',
      }}
    >
      <svg
        viewBox={`0 0 ${CANVAS.W * SCALE} ${CANVAS.H * SCALE}`}
        width={THUMB_W}
        height={THUMB_H}
        style={{
          background: L.bgBase === 'blue' ? BRAND.blue : BRAND.cream,
          borderRadius: 2,
        }}
      >
        <rect
          x={decor.x * SCALE}
          y={decor.y * SCALE}
          width={decor.w * SCALE}
          height={decor.h * SCALE}
          fill={BRAND.blue}
          opacity={L.bgBase === 'blue' ? 0.4 : 0.75}
        />
        {L.overlay && (
          <rect x={0} y={0} width={CANVAS.W * SCALE} height={CANVAS.H * SCALE} fill={L.overlay.color} opacity={L.overlay.opacity * 0.7} />
        )}
        {L.accent && (
          <rect x={L.accent.x * SCALE} y={L.accent.y * SCALE} width={L.accent.w * SCALE} height={L.accent.h * SCALE} fill={BRAND.blue} />
        )}
        {[0, 1, 2].map((i) => {
          const y = L.textY * SCALE + i * 8;
          const w = 30 - i * 3;
          const cx = L.textX * SCALE;
          const x = L.textAlign === 'middle' ? cx - w / 2 : L.textAlign === 'end' ? cx - w : cx;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={2.5}
              fill={L.logoOnDark ? BRAND.cream : BRAND.blue}
              opacity={0.9 - i * 0.2}
            />
          );
        })}
        <rect
          x={L.logoAlign === 'center' ? (CANVAS.W * SCALE) / 2 - 8 : L.logoAlign === 'right' ? CANVAS.W * SCALE - 20 : 6}
          y={CANVAS.H * SCALE - 8}
          width={16}
          height={3}
          fill={L.logoOnDark ? BRAND.cream : BRAND.ink}
          opacity={0.6}
        />
      </svg>
      <span
        style={{
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          color: BRAND.cream,
          opacity: active ? 1 : 0.55,
          textAlign: 'center',
        }}
      >
        {preset}
      </span>
    </button>
  );
}
