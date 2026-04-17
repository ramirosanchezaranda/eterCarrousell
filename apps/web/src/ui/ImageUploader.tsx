/**
 * Uploader de imagen con drag&drop + paste (Ctrl+V) + file picker.
 * Devuelve el resultado como dataURL vía `onChange`.
 */
import { useCallback, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, MouseEvent } from 'react';
import { Clipboard, Upload, X } from 'lucide-react';
import { BRAND } from '@/domain';

interface ImageUploaderProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  height?: number;
}

export function ImageUploader({ value, onChange, label, height = 120 }: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [pasteHint, setPasteHint] = useState(false);

  const readFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => onChange((e.target?.result as string) ?? null);
    reader.readAsDataURL(f);
  }, [onChange]);

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || !it.type.startsWith('image/')) continue;
      const file = it.getAsFile();
      if (file) {
        e.preventDefault();
        readFile(file);
        flashPaste(setPasteHint);
        return;
      }
    }
  };

  const handlePasteButton = async () => {
    dropRef.current?.focus();
    try {
      const clipboard = navigator.clipboard as Clipboard & { read?: () => Promise<ClipboardItem[]> };
      if (!clipboard.read) return;
      const items = await clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) continue;
          const blob = await item.getType(type);
          readFile(new File([blob], 'pasted.png', { type }));
          flashPaste(setPasteHint);
          return;
        }
      }
    } catch (err) {
      console.warn('Clipboard API not available', err);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setFocused(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).focus();
    // Siempre abrir el picker — permite reemplazar la imagen sin borrarla primero.
    fileRef.current?.click();
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7 }}>{label}</div>
        <button
          onClick={handlePasteButton}
          style={{
            background: 'transparent',
            border: `1px solid ${BRAND.cream}20`,
            color: BRAND.cream,
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            opacity: 0.8,
          }}
        >
          <Clipboard size={11} /> PEGAR
        </button>
      </div>
      <div
        ref={dropRef}
        tabIndex={0}
        onClick={handleClick}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setFocused(true); }}
        onDragLeave={() => setFocused(false)}
        style={{
          position: 'relative',
          height,
          border: `1.5px ${focused || pasteHint ? 'solid' : 'dashed'} ${pasteHint ? '#4AE290' : focused ? BRAND.blue : BRAND.cream + '30'}`,
          borderRadius: 6,
          background: '#14141E',
          cursor: value ? 'default' : 'pointer',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
        }}
      >
        {value ? (
          <>
            <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                background: '#0A0A14CC',
                border: 'none',
                color: BRAND.cream,
                width: 26,
                height: 26,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', opacity: focused ? 0.9 : 0.5 }}>
            <Upload size={18} style={{ marginBottom: 4 }} />
            <div style={{ fontSize: 11 }}>{focused ? 'Ctrl+V para pegar' : 'Click, arrastrá o pegá'}</div>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
          // Reset value para que seleccionar el mismo archivo dispare change de nuevo.
          e.target.value = '';
        }}
      />
    </div>
  );
}

function flashPaste(setter: (v: boolean) => void): void {
  setter(true);
  setTimeout(() => setter(false), 1500);
}
