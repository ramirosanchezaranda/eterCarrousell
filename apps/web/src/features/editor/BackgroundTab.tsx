/**
 * Tab "Fondo" — configura el background del slide activo:
 *   - solid color
 *   - gradient 2 stops con ángulo
 *   - imagen (desde galería o upload directo)
 *   - quitar (volver al bg del theme)
 */
import { useState } from 'react';
import { Image as ImageIcon, Paintbrush, Square, X } from 'lucide-react';
import { BRAND } from '@/domain';
import type { SlideBackground } from '@/domain';
import { useProjectStore } from '@/state/projectStore';
import { useAssetsStore } from '@/state/assetsStore';

export function BackgroundTab() {
  const project = useProjectStore();
  const assets = useAssetsStore();
  const slide = project.slides.find((s) => s.id === project.currentSlideId);

  if (!slide) {
    return <p style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.5 }}>Sin slide activo.</p>;
  }

  const bg = slide.background;
  const kind = bg?.kind ?? 'theme';

  const setBg = (next: SlideBackground | null) => project.setSlideBackground(slide.id, next);

  return (
    <>
      <SectionTitle>Tipo de fondo</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 12 }}>
        <TypeBtn active={kind === 'theme'}    onClick={() => setBg(null)}><X size={14} /></TypeBtn>
        <TypeBtn active={kind === 'solid'}    onClick={() => setBg({ kind: 'solid', color: assets.theme.colors.bg })}><Square size={14} /></TypeBtn>
        <TypeBtn active={kind === 'gradient'} onClick={() => setBg({ kind: 'gradient', angle: 135, stops: [{ color: assets.theme.colors.primary, at: 0 }, { color: assets.theme.colors.bg, at: 1 }] })}><Paintbrush size={14} /></TypeBtn>
        <TypeBtn active={kind === 'image'}    onClick={() => setBg({ kind: 'image', src: assets.decorADataURI ?? '', fit: 'cover' })}><ImageIcon size={14} /></TypeBtn>
      </div>
      <p style={{ fontSize: 10, opacity: 0.45, lineHeight: 1.5, marginBottom: 12 }}>
        {kind === 'theme'    ? 'Fondo del theme (el color base actual de la marca).'
        : kind === 'solid'   ? 'Color sólido.'
        : kind === 'gradient'? 'Degradado lineal entre dos colores.'
        : 'Imagen de fondo.'}
      </p>
      {bg?.kind === 'solid' && <SolidEditor bg={bg} onChange={setBg} />}
      {bg?.kind === 'gradient' && <GradientEditor bg={bg} onChange={setBg} />}
      {bg?.kind === 'image' && <ImageEditor bg={bg} onChange={setBg} />}
    </>
  );
}

function SolidEditor({ bg, onChange }: { bg: Extract<SlideBackground, { kind: 'solid' }>; onChange: (b: SlideBackground) => void }) {
  return (
    <div>
      <Label>Color</Label>
      <input type="color" value={bg.color} onChange={(e) => onChange({ ...bg, color: e.target.value })} style={colorInput} />
    </div>
  );
}

function GradientEditor({ bg, onChange }: { bg: Extract<SlideBackground, { kind: 'gradient' }>; onChange: (b: SlideBackground) => void }) {
  return (
    <div>
      <Label>Ángulo ({bg.angle}°)</Label>
      <input
        type="range" min={0} max={360}
        value={bg.angle}
        onChange={(e) => onChange({ ...bg, angle: Number(e.target.value) })}
        style={{ width: '100%' }}
      />
      {bg.stops.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <input
            type="color" value={s.color}
            onChange={(e) => {
              const stops = bg.stops.map((x, j) => j === i ? { ...x, color: e.target.value } : x);
              onChange({ ...bg, stops });
            }}
            style={{ width: 46, height: 28, border: 'none', background: 'transparent', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, opacity: 0.7, minWidth: 48 }}>Stop {i + 1}</span>
          <input
            type="range" min={0} max={1} step={0.05} value={s.at}
            onChange={(e) => {
              const stops = bg.stops.map((x, j) => j === i ? { ...x, at: Number(e.target.value) } : x);
              onChange({ ...bg, stops });
            }}
            style={{ flex: 1 }}
          />
        </div>
      ))}
    </div>
  );
}

function ImageEditor({ bg, onChange }: { bg: Extract<SlideBackground, { kind: 'image' }>; onChange: (b: SlideBackground) => void }) {
  const assets = useAssetsStore();
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File) => {
    setUploading(true);
    const dataURI = await fileToDataURI(file);
    await assets.addGalleryImage(dataURI, file.name);
    onChange({ ...bg, src: dataURI });
    setUploading(false);
  };

  return (
    <>
      <Label>Fit</Label>
      <select value={bg.fit} onChange={(e) => onChange({ ...bg, fit: e.target.value as 'cover' | 'contain' | 'fill' })} style={selectStyle}>
        <option value="cover">cover (llena, recorta)</option>
        <option value="contain">contain (entra, márgenes)</option>
        <option value="fill">fill (estira)</option>
      </select>
      <Label>Opacidad ({Math.round((bg.opacity ?? 1) * 100)}%)</Label>
      <input
        type="range" min={0} max={1} step={0.05}
        value={bg.opacity ?? 1}
        onChange={(e) => onChange({ ...bg, opacity: Number(e.target.value) })}
        style={{ width: '100%' }}
      />
      <Label>Imagen</Label>
      {bg.src ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <img src={bg.src} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} alt="" />
          <button
            onClick={() => onChange({ ...bg, src: '' })}
            style={{ padding: '6px 10px', background: 'transparent', border: `1px solid ${BRAND.cream}20`, borderRadius: 4, color: BRAND.cream, cursor: 'pointer', fontSize: 11 }}
          >
            Quitar
          </button>
        </div>
      ) : null}
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <span style={uploadBtn}>
          {uploading ? 'Cargando...' : 'Subir imagen'}
        </span>
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </label>
      {assets.gallery.length > 0 && (
        <>
          <Label>Desde galería</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {assets.gallery.map((g) => {
              const du = assets.galleryData[g.id];
              if (!du) return null;
              return (
                <button
                  key={g.id}
                  onClick={() => onChange({ ...bg, src: du })}
                  style={{ padding: 0, background: 'transparent', border: bg.src === du ? `2px solid ${BRAND.blue}` : `1px solid ${BRAND.cream}20`, borderRadius: 4, cursor: 'pointer', overflow: 'hidden' }}
                >
                  <img src={du} alt={g.name ?? ''} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 10, marginTop: 16 }}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, opacity: 0.6, marginTop: 8, marginBottom: 4, letterSpacing: 0.6 }}>{children}</div>;
}
function TypeBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 10, background: active ? `${BRAND.blue}40` : '#14141E',
        border: `1px solid ${active ? BRAND.blue : BRAND.cream + '15'}`,
        borderRadius: 6, color: BRAND.cream, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

const colorInput: React.CSSProperties = {
  width: '100%', height: 40, padding: 2, background: '#0A0A14',
  border: `1px solid ${BRAND.cream}20`, borderRadius: 4, cursor: 'pointer',
};
const selectStyle: React.CSSProperties = {
  width: '100%', padding: 8, background: '#0A0A14', border: `1px solid ${BRAND.cream}20`,
  color: BRAND.cream, borderRadius: 4, fontSize: 11,
};
const uploadBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10,
  background: '#14141E', border: `1px dashed ${BRAND.cream}30`, borderRadius: 6,
  color: BRAND.cream, fontSize: 11, cursor: 'pointer',
};

function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}
