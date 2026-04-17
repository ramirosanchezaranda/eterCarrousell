/**
 * Columna lateral DERECHA del editor — tipo Figma/Canva.
 * Se colapsa cuando no hay bloque seleccionado mostrando un hint.
 * Cuando hay uno o varios seleccionados, muestra el PropertiesPanel.
 */
import { MousePointer2 } from 'lucide-react';
import { BRAND } from '@/domain';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';
import { PropertiesPanel } from './PropertiesPanel';

export function PropertiesColumn() {
  const project = useProjectStore();
  const ui = useUiStore();
  const activeSlide = project.slides.find((s) => s.id === project.currentSlideId);
  const selectedBlock = activeSlide?.blocks.find((b) => ui.selectedBlockIds.includes(b.id));

  return (
    <aside
      aria-label="Propiedades del bloque seleccionado"
      style={{
        position: 'sticky',
        top: 24,
        alignSelf: 'start',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        paddingLeft: 2,
        width: 320,
      }}
    >
      {selectedBlock && activeSlide ? (
        <PropertiesPanel block={selectedBlock} slideId={activeSlide.id} />
      ) : (
        <EmptyHint />
      )}
    </aside>
  );
}

function EmptyHint() {
  return (
    <div style={{
      padding: 24,
      background: '#14141E',
      border: `1px dashed ${BRAND.cream}15`,
      borderRadius: 8,
      color: BRAND.cream,
      textAlign: 'center',
    }}>
      <MousePointer2 size={22} style={{ opacity: 0.35, marginBottom: 10 }} />
      <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.5 }}>
        Seleccioná un bloque del canvas o del panel de capas para ver sus propiedades acá.
      </div>
    </div>
  );
}
