/**
 * Modal con la lista de atajos de teclado. Se abre con `?` o `Ctrl+/`.
 */
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { BRAND } from '@/domain';
import { useUiStore } from '@/state/uiStore';

interface Row { label: string; keys: string[] }

const GLOBAL: Row[] = [
  { label: 'Deshacer / Rehacer',         keys: ['Ctrl+Z', 'Ctrl+Y'] },
  { label: 'Seleccionar todo',           keys: ['Ctrl+A'] },
  { label: 'Descargar slide actual',     keys: ['Ctrl+S'] },
  { label: 'Descargar todas',            keys: ['Ctrl+Shift+S'] },
  { label: 'Duplicar slide',             keys: ['Ctrl+Shift+D'] },
  { label: 'Slide anterior / siguiente', keys: ['PageUp', 'PageDown'] },
  { label: '                        o',  keys: ['Alt+←', 'Alt+→'] },
  { label: 'Pegar imagen / bloques',     keys: ['Ctrl+V'] },
  { label: 'Zoom in / out',             keys: ['Ctrl++', 'Ctrl+-'] },
  { label: 'Zoom in (scroll)',           keys: ['Ctrl+Scroll ↑'] },
  { label: 'Resetear vista (100%)',      keys: ['Ctrl+0'] },
  { label: 'Pan (desplazar canvas)',     keys: ['Espacio+drag'] },
  { label: 'Pan con scroll',            keys: ['Scroll sin Ctrl'] },
  { label: 'Abrir esta ayuda',           keys: ['?', 'Ctrl+/'] },
  { label: 'Cerrar / deseleccionar',     keys: ['Esc'] },
];

const SELECTION: Row[] = [
  { label: 'Eliminar',                 keys: ['Del', 'Backspace'] },
  { label: 'Duplicar bloque',          keys: ['Ctrl+D'] },
  { label: 'Copiar / Cortar',          keys: ['Ctrl+C', 'Ctrl+X'] },
  { label: 'Bloquear / Desbloquear',   keys: ['Ctrl+L'] },
  { label: 'Subir / Bajar (z-order)',  keys: ['Ctrl+]', 'Ctrl+['] },
  { label: 'Mover 1 px',               keys: ['← ↑ → ↓'] },
  { label: 'Mover 10 px',              keys: ['Shift+← ↑ → ↓'] },
  { label: 'Editar texto inline',      keys: ['doble click'] },
  { label: 'Menu contextual',          keys: ['click derecho'] },
  { label: 'Selección múltiple',       keys: ['Shift+click'] },
];

export function ShortcutsHelp() {
  const open = useUiStore((s) => s.showShortcutsHelp);
  const close = useUiStore((s) => s.setShowShortcutsHelp);
  if (!open) return null;

  return createPortal(
    <div
      onClick={() => close(false)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#14141E', border: `1px solid ${BRAND.blue}40`, borderRadius: 12,
          padding: 28, maxWidth: 720, width: '100%', maxHeight: '86vh', overflow: 'auto',
          color: BRAND.cream, boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Atajos de teclado</h2>
          <button
            onClick={() => close(false)}
            style={{ background: 'transparent', border: `1px solid ${BRAND.cream}20`, color: BRAND.cream, borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' }}
          >
            <X size={14} />
          </button>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <Section title="Globales" rows={GLOBAL} />
          <Section title="Con selección" rows={SELECTION} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.55, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, opacity: 0.85 }}>{r.label}</span>
            <span style={{ display: 'flex', gap: 4 }}>
              {r.keys.map((k, j) => (
                <kbd
                  key={j}
                  style={{
                    background: '#0A0A14', border: `1px solid ${BRAND.cream}25`,
                    borderRadius: 4, padding: '3px 8px', fontSize: 10.5, fontFamily: 'monospace',
                    color: BRAND.cream, whiteSpace: 'nowrap',
                  }}
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
