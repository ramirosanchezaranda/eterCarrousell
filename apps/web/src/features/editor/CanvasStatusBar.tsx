/**
 * Barra de estado inferior del canvas — estilo Canva.
 *
 *   [ subtitle del slide ]          [ ◀ X/Y ▶ ]          [ - slider + ] [%] [grid] [fullscreen]
 *
 * Contiene:
 *   - Navegación prev/next con contador "X / Y"
 *   - Zoom slider (1x → 4x) + porcentaje clickeable (reset a 100%)
 *   - Botón grid view (abre modal con todas las slides en cuadrícula)
 *   - Botón fullscreen del canvas (oculta chrome del editor)
 */
import { ChevronLeft, ChevronRight, LayoutGrid, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { BRAND } from '@/domain';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';

interface Props {
  subtitle?: string;
}

export function CanvasStatusBar({ subtitle }: Props) {
  const project = useProjectStore();
  const ui = useUiStore();
  const slides = project.slides;
  const currentIdx = Math.max(0, slides.findIndex((s) => s.id === project.currentSlideId));

  const goPrev = () => { const p = slides[currentIdx - 1]; if (p) project.setCurrentSlideId(p.id); };
  const goNext = () => { const n = slides[currentIdx + 1]; if (n) project.setCurrentSlideId(n.id); };

  const zoomIn  = () => ui.setZoom(Math.min(4, Number((ui.zoom * 1.15).toFixed(3))));
  const zoomOut = () => ui.setZoom(Math.max(1, Number((ui.zoom / 1.15).toFixed(3))));
  const onSliderChange = (v: number) => ui.setZoom(v);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '6px 12px',
      background: '#14141E',
      borderTop: `1px solid ${BRAND.cream}12`,
      fontSize: 11,
      color: BRAND.cream,
      flexWrap: 'wrap',
    }}>
      {/* IZQUIERDA: Subtitle del slide */}
      <div style={{
        flex: '1 1 200px',
        minWidth: 0,
        opacity: 0.6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'monospace',
        fontSize: 10,
      }}>
        {subtitle}
      </div>

      {/* CENTRO: navegación de slides */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconBtn onClick={goPrev} disabled={currentIdx <= 0} title="Anterior (←)">
          <ChevronLeft size={14} />
        </IconBtn>
        <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.8, minWidth: 52, textAlign: 'center' }}>
          {String(currentIdx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
        <IconBtn onClick={goNext} disabled={currentIdx >= slides.length - 1} title="Siguiente (→)">
          <ChevronRight size={14} />
        </IconBtn>
      </div>

      {/* DERECHA: zoom + grid + fullscreen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
        <IconBtn onClick={zoomOut} title="Alejar">
          <Minus size={13} />
        </IconBtn>
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={ui.zoom}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          style={{ width: 120, accentColor: BRAND.blue }}
          title="Zoom"
        />
        <IconBtn onClick={zoomIn} title="Acercar">
          <Plus size={13} />
        </IconBtn>
        <button
          onClick={() => ui.resetView()}
          title="Reset zoom (100%)"
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            background: 'transparent',
            color: BRAND.cream,
            border: `1px solid ${BRAND.cream}25`,
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'pointer',
            minWidth: 54,
          }}
        >
          {Math.round(ui.zoom * 100)}%
        </button>
        <Divider />
        <IconBtn onClick={() => ui.setGridViewOpen(true)} title="Ver todas las páginas">
          <LayoutGrid size={14} />
        </IconBtn>
        <IconBtn onClick={ui.toggleCanvasFullscreen} title={ui.canvasFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
          {ui.canvasFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children, onClick, disabled, title,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'transparent',
        border: `1px solid ${BRAND.cream}25`,
        color: BRAND.cream,
        padding: 6,
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: `${BRAND.cream}15`, margin: '0 3px' }} />;
}
