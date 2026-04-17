/**
 * Grilla de la galería de imágenes reusables. Click "+" para subir,
 * Ctrl+V para pegar del clipboard. Click en imagen → agrega al slide activo.
 * Click derecho en imagen → menu con "eliminar".
 */
import { useEffect, useRef, useState } from 'react';
import { Plus, Clipboard as ClipboardIcon, Trash2 } from 'lucide-react';
import { BRAND } from '@/domain';
import { FORMATS } from '@/formats';
import { useAssetsStore } from '@/state/assetsStore';
import { useProjectStore } from '@/state/projectStore';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

export function GalleryGrid() {
  const assets = useAssetsStore();
  const project = useProjectStore();
  const format = FORMATS[project.formatId];
  const inputRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; imageId: string } | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f || !f.type.startsWith('image/')) continue;
      const dataURI = await fileToDataURI(f);
      await assets.addGalleryImage(dataURI, f.name);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const clipboard = navigator.clipboard as Clipboard & { read?: () => Promise<ClipboardItem[]> };
      if (!clipboard.read) return;
      const items = await clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) continue;
          const blob = await item.getType(type);
          const dataURI = await blobToDataURI(blob);
          await assets.addGalleryImage(dataURI, 'pasted');
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard read falló', err);
    }
  };

  // Listener global de paste — si alguien hace Ctrl+V y no hay input activo,
  // agregamos al gallery.
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || !it.type.startsWith('image/')) continue;
        const file = it.getAsFile();
        if (!file) continue;
        e.preventDefault();
        const dataURI = await fileToDataURI(file);
        await assets.addGalleryImage(dataURI, 'pasted');
        return;
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [assets]);

  const addToCanvas = (dataURI: string) => {
    if (!project.currentSlideId) return;
    project.addImageBlock(project.currentSlideId, dataURI, format);
  };

  const menuItems = (imageId: string): ContextMenuItem[] => [
    { key: 'add', label: 'Agregar al slide', onSelect: () => { const d = assets.galleryData[imageId]; if (d) addToCanvas(d); } },
    { key: 'sep', label: '', separator: true, onSelect: () => {} },
    { key: 'del', label: 'Eliminar de galería', icon: <Trash2 size={12} />, danger: true, onSelect: () => void assets.removeGalleryImage(imageId) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button onClick={() => inputRef.current?.click()} style={btnPrimary}>
          <Plus size={13} /> Subir
        </button>
        <button onClick={pasteFromClipboard} style={btnSecondary} title="Pegar del portapapeles">
          <ClipboardIcon size={13} /> Pegar
        </button>
      </div>
      <p style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.5, marginBottom: 8 }}>
        Ctrl+V también pega imágenes directo a la galería. Click en una imagen para agregarla al slide activo.
      </p>
      {assets.gallery.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', background: '#14141E', border: `1px dashed ${BRAND.cream}20`, borderRadius: 6, fontSize: 11, opacity: 0.55 }}>
          Sin imágenes. Subí o pegá para empezar.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {assets.gallery.map((g) => {
            const du = assets.galleryData[g.id];
            if (!du) return null;
            return (
              <button
                key={g.id}
                onClick={() => addToCanvas(du)}
                onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, imageId: g.id }); }}
                title={g.name ?? ''}
                style={{ padding: 0, border: `1px solid ${BRAND.cream}15`, borderRadius: 4, cursor: 'pointer', overflow: 'hidden', background: '#0A0A14' }}
              >
                <img src={du} alt={g.name ?? ''} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
              </button>
            );
          })}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }}
      />
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.imageId)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '8px 10px', background: BRAND.blue, border: 'none', borderRadius: 6,
  color: BRAND.cream, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};
const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '8px 10px', background: 'transparent', border: `1px solid ${BRAND.cream}30`,
  borderRadius: 6, color: BRAND.cream, fontSize: 11, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};

function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}
function blobToDataURI(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(blob);
  });
}
