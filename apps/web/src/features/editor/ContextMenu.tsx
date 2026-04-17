/**
 * Menú contextual flotante. Se renderiza en un portal anclado a body con
 * posición absoluta. Se cierra al clickear fuera, Escape, o al seleccionar.
 * Items son configurables — el caller arma la lista según el target.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BRAND } from '@/domain';

export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  hotkey?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  separator?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Clamp a la viewport para que no salga por la derecha/abajo
  const menuW = 220;
  const menuH = items.length * 32 + 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(x, vw - menuW - 8);
  const top = Math.min(y, vh - menuH - 8);

  return createPortal(
    <div
      ref={ref}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left, top, minWidth: menuW,
        background: '#14141E', border: `1px solid ${BRAND.blue}40`, borderRadius: 6,
        padding: 4, boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
        zIndex: 9999, fontSize: 12, color: BRAND.cream, userSelect: 'none',
      }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={`sep-${i}`} style={{ height: 1, background: BRAND.cream + '15', margin: '4px 0' }} />;
        }
        return (
          <button
            key={item.key}
            disabled={item.disabled}
            onClick={(e) => { e.stopPropagation(); item.onSelect(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', width: '100%',
              gap: 8, padding: '7px 10px', background: 'transparent',
              color: item.danger ? '#FF6B6B' : BRAND.cream,
              border: 'none', borderRadius: 4, cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.4 : 1,
              textAlign: 'left', fontSize: 12,
            }}
            onMouseEnter={(e) => { if (!item.disabled) (e.currentTarget as HTMLButtonElement).style.background = BRAND.blue + '30'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
              {item.icon}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.hotkey && (
              <span style={{ opacity: 0.5, fontFamily: 'monospace', fontSize: 10 }}>{item.hotkey}</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
