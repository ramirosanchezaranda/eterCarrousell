/**
 * Uploader de fuentes custom (.ttf/.otf/.woff/.woff2). Carga vía FontFace API
 * y muestra un preview con la tipografía ya registrada.
 */
import { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { BRAND } from '@/domain';
import type { CustomFont } from '@/domain';
import { loadCustomFont, unloadCustomFont } from '@/assets/fonts';

interface FontUploaderProps {
  value: CustomFont | null;
  onChange: (value: CustomFont | null) => void;
  label: string;
  slotName: string;
}

export function FontUploader({ value, onChange, label, slotName }: FontUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      if (value) unloadCustomFont(value);
      onChange(await loadCustomFont(f, slotName));
    } catch (e) {
      console.error(e);
      setError('No se pudo cargar.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    if (value) unloadCustomFont(value);
    onChange(null);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>
        {label}
      </div>
      {value ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: 12,
          background: '#14141E', border: `1px solid ${BRAND.blue}40`, borderRadius: 6,
        }}>
          <div style={{
            fontFamily: `"${value.internalName}", serif`,
            fontSize: 28, color: BRAND.blue, fontStyle: 'italic', lineHeight: 1,
          }}>
            Aa Áá
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value.fileName}
            </div>
            <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
              {value.format}
            </div>
          </div>
          <button
            onClick={handleRemove}
            style={{
              background: 'transparent', border: `1px solid ${BRAND.cream}20`, color: BRAND.cream,
              width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          style={{
            width: '100%', padding: 14, background: '#14141E',
            border: `1px dashed ${BRAND.cream}30`, borderRadius: 6,
            color: BRAND.cream, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 12, opacity: loading ? 0.5 : 0.8,
          }}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
          {loading ? 'Cargando...' : 'Subir .ttf / .otf / .woff / .woff2'}
        </button>
      )}
      {error && <div style={{ marginTop: 6, fontSize: 11, color: '#FF6B6B' }}>{error}</div>}
      <input
        ref={fileRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
