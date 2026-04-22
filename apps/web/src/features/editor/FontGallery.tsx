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

interface UploadProgress {
  total: number;
  done: number;
  failed: Array<{ name: string; error: string }>;
}

export function FontGallery() {
  const assets = useAssetsStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  /**
   * Procesa todas las fuentes seleccionadas en paralelo con Promise.all.
   * Esto es bastante más rápido que el loop secuencial que había antes
   * porque `loadCustomFont` hace I/O (FileReader + FontFace.load) y se
   * puede solapar. Muestra progress "X / Y" mientras carga, y lista los
   * fallos al final (p.ej. woff2 que FontFace rechace).
   */
  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setProgress({ total: list.length, done: 0, failed: [] });
    const batchId = Date.now();
    const results = await Promise.allSettled(
      list.map(async (f, i) => {
        const font = await loadCustomFont(f, `gal-${batchId}-${i}`);
        await assets.addCustomFont(font);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      })
    );
    const failed = results
      .map((r, i) => ({ r, name: list[i]?.name ?? 'unknown' }))
      .filter(({ r }) => r.status === 'rejected')
      .map(({ r, name }) => ({
        name,
        error: (r as PromiseRejectedResult).reason instanceof Error
          ? ((r as PromiseRejectedResult).reason as Error).message
          : String((r as PromiseRejectedResult).reason),
      }));
    setProgress((p) => (p ? { ...p, done: list.length, failed } : p));
    // Auto-limpieza del banner de progreso si todo OK.
    if (failed.length === 0) {
      setTimeout(() => setProgress(null), 1200);
    }
  };

  const uploading = !!progress && progress.done < progress.total;

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
        <Plus size={13} /> {uploading ? `Subiendo ${progress!.done}/${progress!.total}...` : 'Subir fuentes'}
      </button>
      <p style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.5, marginTop: 6, marginBottom: 10 }}>
        .ttf / .otf / .woff / .woff2 — seleccioná varias a la vez con Ctrl/Shift.
        <br />Usá <strong>Display</strong> para titulares y <strong>Sans</strong> para texto de soporte.
      </p>
      {/* Progress bar mientras cargan en paralelo */}
      {progress && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            height: 4,
            background: '#14141E',
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 4,
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round((progress.done / progress.total) * 100)}%`,
              background: BRAND.blue,
              transition: 'width 150ms ease',
            }} />
          </div>
          {progress.failed.length > 0 && (
            <div style={{
              padding: 6,
              background: '#2A1414',
              border: '1px solid #FF6B6B40',
              borderRadius: 4,
              fontSize: 10,
              lineHeight: 1.5,
            }}>
              <strong style={{ color: '#FF6B6B' }}>{progress.failed.length} fuente{progress.failed.length === 1 ? '' : 's'} fallaron:</strong>
              {progress.failed.slice(0, 4).map((f, i) => (
                <div key={i} style={{ opacity: 0.75, marginTop: 2 }}>
                  • {f.name} — {f.error.slice(0, 60)}
                </div>
              ))}
              <button
                onClick={() => setProgress(null)}
                style={{
                  marginTop: 4, background: 'transparent', border: 'none',
                  color: BRAND.cream, opacity: 0.5, fontSize: 10, cursor: 'pointer', padding: 0,
                }}
              >
                cerrar
              </button>
            </div>
          )}
        </div>
      )}
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
