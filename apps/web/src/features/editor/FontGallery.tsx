/**
 * Galería de fuentes custom. El usuario puede subir N fuentes ilimitadas.
 * Cada fila muestra:
 *   - Preview "Aa" con la fuente real.
 *   - Nombre + formato.
 *   - Botón "Display" — marca esta fuente como el display activo del theme.
 *   - Botón "Sans"    — marca esta fuente como el sans activo del theme.
 *   - Botón eliminar (bin).
 * El chip activo se ve en azul sólido con tick. Click en el mismo slot activo
 * lo des-asigna (vuelve al preset base).
 */
import { useRef, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { BRAND } from '@/domain';
import { useAssetsStore } from '@/state/assetsStore';
import { loadCustomFont, unloadCustomFont } from '@/assets/fonts';

export function FontGallery() {
  const assets = useAssetsStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f) continue;
        const font = await loadCustomFont(f, `gal-${Date.now()}-${i}`);
        await assets.addCustomFont(font);
      }
    } catch (err) {
      console.error('font upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const activeDisplay = assets.customDisplay?.internalName ?? null;
  const activeSans = assets.customSans?.internalName ?? null;

  const toggle = (internalName: string, slot: 'display' | 'sans') => {
    const currentActive = slot === 'display' ? activeDisplay : activeSans;
    if (currentActive === internalName) {
      assets.assignGalleryFontToSlot(null, slot);
    } else {
      assets.assignGalleryFontToSlot(internalName, slot);
    }
  };

  return (
    <div>
      <button onClick={() => inputRef.current?.click()} disabled={uploading} style={uploadBtn}>
        <Plus size={13} /> {uploading ? 'Subiendo...' : 'Subir fuentes'}
      </button>
      <p style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.5, marginTop: 6, marginBottom: 10 }}>
        .ttf / .otf / .woff / .woff2 — podés subir varias a la vez.
        <br />Usá <strong>Display</strong> para titulares y <strong>Sans</strong> para texto de soporte.
      </p>
      {assets.fontGallery.length === 0 ? (
        <div style={emptyStyle}>Sin fuentes aún.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {assets.fontGallery.map((f) => {
            const isDisplay = activeDisplay === f.internalName;
            const isSans = activeSans === f.internalName;
            return (
              <div key={f.internalName} style={fontRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: `"${f.internalName}", serif`, fontSize: 28, color: BRAND.blue, fontStyle: 'italic', lineHeight: 1 }}>
                    Aa
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.fileName}
                    </div>
                    <div style={{ fontSize: 9, opacity: 0.5, textTransform: 'uppercase' }}>{f.format}</div>
                  </div>
                  <button
                    onClick={() => {
                      try {
                        const existing = Array.from(document.fonts as unknown as Iterable<FontFace>)
                          .find((ff) => ff.family === f.internalName);
                        if (existing) unloadCustomFont({ ...f, dataURI: '', fontFace: existing });
                      } catch {}
                      void assets.removeCustomFont(f.internalName);
                    }}
                    style={removeBtn}
                    title="Eliminar"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <SlotBtn active={isDisplay} onClick={() => toggle(f.internalName, 'display')}>
                    {isDisplay && <Check size={10} />} Display
                  </SlotBtn>
                  <SlotBtn active={isSans} onClick={() => toggle(f.internalName, 'sans')}>
                    {isSans && <Check size={10} />} Sans
                  </SlotBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        multiple
        hidden
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function SlotBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '6px 8px',
        background: active ? BRAND.blue : 'transparent',
        border: `1px solid ${active ? BRAND.blue : BRAND.cream + '20'}`,
        borderRadius: 4, color: BRAND.cream, fontSize: 10,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        fontWeight: active ? 700 : 400, letterSpacing: 0.5,
      }}
    >
      {children}
    </button>
  );
}

const uploadBtn: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: BRAND.blue, border: 'none', borderRadius: 6,
  color: BRAND.cream, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};
const emptyStyle: React.CSSProperties = {
  padding: 18, textAlign: 'center', background: '#14141E', border: `1px dashed ${BRAND.cream}20`,
  borderRadius: 6, fontSize: 11, opacity: 0.55,
};
const fontRow: React.CSSProperties = {
  padding: 8, background: '#14141E', border: `1px solid ${BRAND.cream}15`, borderRadius: 6,
};
const removeBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', padding: 4, display: 'flex',
};
