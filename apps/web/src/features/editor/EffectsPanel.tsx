/**
 * Panel de efectos para bloques image/decor: duotone, grayscale, blur, invert,
 * sepia, brightness/contrast/saturation/hue, halftone, ascii.
 * Inspirado en tooooools.app y effect.app.
 */
import { Plus, Trash2 } from 'lucide-react';
import type { ImageEffect, PositionedBlock } from '@/domain';
import { BRAND } from '@/domain';
import { useProjectStore } from '@/state/projectStore';

type FxKind = ImageEffect['kind'];
const ALL_KINDS: Array<{ kind: FxKind; label: string; make: () => ImageEffect }> = [
  { kind: 'grayscale',  label: 'Grayscale',  make: () => ({ kind: 'grayscale' }) },
  { kind: 'duotone',    label: 'Duotone',    make: () => ({ kind: 'duotone', dark: '#1B2A7A', light: '#F1E8D3' }) },
  { kind: 'sepia',      label: 'Sepia',      make: () => ({ kind: 'sepia' }) },
  { kind: 'invert',     label: 'Invertir',   make: () => ({ kind: 'invert' }) },
  { kind: 'blur',       label: 'Blur',       make: () => ({ kind: 'blur', radius: 4 }) },
  { kind: 'brightness', label: 'Brillo',     make: () => ({ kind: 'brightness', value: 0 }) },
  { kind: 'contrast',   label: 'Contraste',  make: () => ({ kind: 'contrast', value: 1 }) },
  { kind: 'saturation', label: 'Saturación', make: () => ({ kind: 'saturation', value: 1 }) },
  { kind: 'hue',        label: 'Hue',        make: () => ({ kind: 'hue', deg: 0 }) },
  { kind: 'halftone',   label: 'Halftone',   make: () => ({ kind: 'halftone', size: 8 }) },
  { kind: 'ascii',      label: 'ASCII',      make: () => ({ kind: 'ascii', density: 0.5 }) },
];

interface Props {
  block: PositionedBlock;
  slideId: string;
}

export function EffectsPanel({ block, slideId }: Props) {
  const update = useProjectStore((s) => s.updateBlock);
  // Ahora aplicable a cualquier tipo de bloque: text, image, shape, decor
  const effects = block.content.effects ?? [];

  const patchEffects = (next: ImageEffect[]) => {
    update(slideId, block.id, {
      content: { ...block.content, effects: next.length ? next : undefined } as PositionedBlock['content'],
    });
  };

  const add = (effect: ImageEffect) => patchEffects([...effects, effect]);
  const remove = (i: number) => patchEffects(effects.filter((_, j) => j !== i));
  const updateFx = (i: number, patch: Partial<ImageEffect>) => {
    const next = effects.map((e, j): ImageEffect => j === i ? ({ ...e, ...patch } as ImageEffect) : e);
    patchEffects(next);
  };

  return (
    <div style={wrap}>
      <div style={header}>
        <span style={title}>Efectos · {effects.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
        {ALL_KINDS.filter((k) => !effects.some((e) => e.kind === k.kind)).slice(0, 9).map((k) => (
          <button
            key={k.kind}
            onClick={() => add(k.make())}
            style={addBtn}
          >
            <Plus size={10} /> {k.label}
          </button>
        ))}
      </div>
      {effects.map((e, i) => (
        <FxRow key={i} effect={e} onChange={(p) => updateFx(i, p)} onRemove={() => remove(i)} />
      ))}
    </div>
  );
}

function FxRow({ effect, onChange, onRemove }: { effect: ImageEffect; onChange: (p: Partial<ImageEffect>) => void; onRemove: () => void }) {
  return (
    <div style={row}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <strong style={{ fontSize: 11 }}>{ALL_KINDS.find((k) => k.kind === effect.kind)?.label ?? effect.kind}</strong>
        <button onClick={onRemove} style={removeBtn}><Trash2 size={11} /></button>
      </div>
      {effect.kind === 'duotone' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={swatch}><span>Oscuro</span><input type="color" value={effect.dark} onChange={(ev) => onChange({ dark: ev.target.value })} /></label>
          <label style={swatch}><span>Claro</span><input type="color" value={effect.light} onChange={(ev) => onChange({ light: ev.target.value })} /></label>
        </div>
      )}
      {effect.kind === 'blur' && (
        <Slider label="Radio" value={effect.radius} min={0} max={40} step={0.5} onChange={(v) => onChange({ radius: v })} />
      )}
      {effect.kind === 'brightness' && (
        <Slider label="Valor" value={effect.value} min={-0.8} max={0.8} step={0.05} onChange={(v) => onChange({ value: v })} />
      )}
      {effect.kind === 'contrast' && (
        <Slider label="Valor" value={effect.value} min={0} max={2.5} step={0.05} onChange={(v) => onChange({ value: v })} />
      )}
      {effect.kind === 'saturation' && (
        <Slider label="Valor" value={effect.value} min={0} max={2.5} step={0.05} onChange={(v) => onChange({ value: v })} />
      )}
      {effect.kind === 'hue' && (
        <Slider label="Grados" value={effect.deg} min={0} max={360} step={5} onChange={(v) => onChange({ deg: v })} />
      )}
      {effect.kind === 'halftone' && (
        <Slider label="Tamaño" value={effect.size} min={2} max={30} step={1} onChange={(v) => onChange({ size: v })} />
      )}
      {effect.kind === 'ascii' && (
        <Slider label="Densidad" value={effect.density} min={0} max={1} step={0.05} onChange={(v) => onChange({ density: v })} />
      )}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, opacity: 0.6, width: 50 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ fontSize: 10, fontFamily: 'monospace', width: 38, textAlign: 'right' }}>{value.toFixed(2)}</span>
    </div>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 8, padding: 10, background: '#14141E', border: `1px solid ${BRAND.blue}40`, borderRadius: 6,
};
const header: React.CSSProperties = { marginBottom: 8 };
const title: React.CSSProperties = { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.55 };
const row: React.CSSProperties = {
  padding: 8, marginBottom: 6, background: '#0A0A14',
  border: `1px solid ${BRAND.cream}15`, borderRadius: 4,
};
const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '5px 6px',
  background: 'transparent', border: `1px solid ${BRAND.cream}20`, borderRadius: 4,
  color: BRAND.cream, fontSize: 10, cursor: 'pointer',
};
const removeBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', padding: 2,
};
const swatch: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, opacity: 0.7,
};
