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
/**
 * Todos los efectos disponibles en el panel. El orden importa: los más
 * usados (opacity, blur, shadow, glow) arriba. `applicableTo` indica a qué
 * tipos de bloque tiene sentido aplicarlos — el panel filtra el grid según
 * el `block.content.kind` actual.
 *
 * Para TEXTO todos los efectos funcionan, pero algunos (halftone, ascii,
 * noise) sobre texto generan resultados raros — los marcamos como
 * `appliesToText: false` y los ocultamos cuando el bloque activo es texto.
 */
interface FxDef {
  kind: FxKind;
  label: string;
  make: () => ImageEffect;
  appliesToText: boolean;
}
const ALL_KINDS: FxDef[] = [
  { kind: 'opacity',    label: 'Transparencia', appliesToText: true,  make: () => ({ kind: 'opacity', value: 0.7 }) },
  { kind: 'shadow',     label: 'Sombra',        appliesToText: true,  make: () => ({ kind: 'shadow', dx: 4, dy: 4, blur: 6, color: '#000000', opacity: 0.5 }) },
  { kind: 'glow',       label: 'Glow',          appliesToText: true,  make: () => ({ kind: 'glow', radius: 8, color: '#2E46C8', opacity: 0.8 }) },
  { kind: 'blur',       label: 'Blur',          appliesToText: true,  make: () => ({ kind: 'blur', radius: 4 }) },
  { kind: 'brightness', label: 'Brillo',        appliesToText: true,  make: () => ({ kind: 'brightness', value: 0 }) },
  { kind: 'contrast',   label: 'Contraste',     appliesToText: true,  make: () => ({ kind: 'contrast', value: 1 }) },
  { kind: 'saturation', label: 'Saturación',    appliesToText: true,  make: () => ({ kind: 'saturation', value: 1 }) },
  { kind: 'hue',        label: 'Hue',           appliesToText: true,  make: () => ({ kind: 'hue', deg: 0 }) },
  { kind: 'grayscale',  label: 'Grayscale',     appliesToText: true,  make: () => ({ kind: 'grayscale' }) },
  { kind: 'sepia',      label: 'Sepia',         appliesToText: true,  make: () => ({ kind: 'sepia' }) },
  { kind: 'invert',     label: 'Invertir',      appliesToText: true,  make: () => ({ kind: 'invert' }) },
  { kind: 'duotone',    label: 'Duotone',       appliesToText: false, make: () => ({ kind: 'duotone', dark: '#1B2A7A', light: '#F1E8D3' }) },
  { kind: 'vignette',   label: 'Viñeta',        appliesToText: false, make: () => ({ kind: 'vignette', intensity: 0.5, spread: 0.6 }) },
  { kind: 'noise',      label: 'Grano',         appliesToText: false, make: () => ({ kind: 'noise', amount: 0.25, scale: 2 }) },
  { kind: 'posterize',  label: 'Posterize',     appliesToText: true,  make: () => ({ kind: 'posterize', levels: 4 }) },
  { kind: 'pixelate',   label: 'Pixelado',      appliesToText: false, make: () => ({ kind: 'pixelate', size: 10 }) },
  { kind: 'halftone',   label: 'Halftone',      appliesToText: false, make: () => ({ kind: 'halftone', size: 8 }) },
  { kind: 'ascii',      label: 'ASCII',         appliesToText: false, make: () => ({ kind: 'ascii', density: 0.5 }) },
  { kind: 'chromatic',  label: 'RGB Split',     appliesToText: true,  make: () => ({ kind: 'chromatic', offset: 4 }) },
  { kind: 'scanlines',  label: 'Scanlines',     appliesToText: false, make: () => ({ kind: 'scanlines', gap: 4, opacity: 0.35 }) },
  { kind: 'emboss',     label: 'Relieve',       appliesToText: true,  make: () => ({ kind: 'emboss', strength: 1 }) },
  { kind: 'sharpen',    label: 'Sharpen',       appliesToText: false, make: () => ({ kind: 'sharpen', strength: 0.4 }) },
  { kind: 'overlay-color', label: 'Teñido',     appliesToText: true,  make: () => ({ kind: 'overlay-color', color: '#2E46C8', opacity: 0.35 }) },
  { kind: 'threshold',  label: 'Threshold',     appliesToText: false, make: () => ({ kind: 'threshold', level: 0.5 }) },
  { kind: 'inner-shadow',  label: 'Sombra int.',  appliesToText: true,  make: () => ({ kind: 'inner-shadow', dx: 0, dy: 3, blur: 6, color: '#000000', opacity: 0.55 }) },
  { kind: 'gradient-map',  label: 'Gradient map', appliesToText: true,  make: () => ({ kind: 'gradient-map', dark: '#0A0A14', mid: '#2E46C8', light: '#F1E8D3' }) },
  { kind: 'bloom',         label: 'Bloom',        appliesToText: true,  make: () => ({ kind: 'bloom', threshold: 0.65, radius: 8, intensity: 0.9 }) },
  { kind: 'outline',       label: 'Contorno',     appliesToText: true,  make: () => ({ kind: 'outline', width: 2, color: '#F1E8D3' }) },
  { kind: 'motion-blur',   label: 'Motion blur',  appliesToText: true,  make: () => ({ kind: 'motion-blur', strength: 6, angle: 0 }) },
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

  const isText = block.content.kind === 'text';
  // Filtra los efectos del grid según el tipo de bloque: en texto ocultamos
  // los que no tienen sentido visual (halftone / ascii / noise / duotone).
  const availableKinds = ALL_KINDS.filter((k) => {
    if (isText && !k.appliesToText) return false;
    return !effects.some((e) => e.kind === k.kind);
  });

  return (
    <div style={wrap}>
      <div style={header}>
        <span style={title}>Efectos · {effects.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
        {availableKinds.map((k) => (
          <button
            key={k.kind}
            onClick={() => add(k.make())}
            style={addBtn}
            title={`Agregar efecto: ${k.label}`}
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
      {effect.kind === 'opacity' && (
        <Slider label="Valor" value={effect.value} min={0} max={1} step={0.02} onChange={(v) => onChange({ value: v })} />
      )}
      {effect.kind === 'shadow' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <Slider label="X" value={effect.dx} min={-30} max={30} step={1} onChange={(v) => onChange({ dx: v })} />
            <Slider label="Y" value={effect.dy} min={-30} max={30} step={1} onChange={(v) => onChange({ dy: v })} />
          </div>
          <Slider label="Blur" value={effect.blur} min={0} max={40} step={0.5} onChange={(v) => onChange({ blur: v })} />
          <Slider label="Alpha" value={effect.opacity} min={0} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} />
          <label style={{ ...swatch, marginTop: 4 }}>
            <span>Color</span>
            <input type="color" value={effect.color} onChange={(ev) => onChange({ color: ev.target.value })} />
          </label>
        </>
      )}
      {effect.kind === 'glow' && (
        <>
          <Slider label="Radio" value={effect.radius} min={0} max={40} step={0.5} onChange={(v) => onChange({ radius: v })} />
          <Slider label="Alpha" value={effect.opacity} min={0} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} />
          <label style={{ ...swatch, marginTop: 4 }}>
            <span>Color</span>
            <input type="color" value={effect.color} onChange={(ev) => onChange({ color: ev.target.value })} />
          </label>
        </>
      )}
      {effect.kind === 'noise' && (
        <>
          <Slider label="Cantidad" value={effect.amount} min={0} max={1} step={0.05} onChange={(v) => onChange({ amount: v })} />
          <Slider label="Escala" value={effect.scale} min={0.5} max={8} step={0.2} onChange={(v) => onChange({ scale: v })} />
        </>
      )}
      {effect.kind === 'vignette' && (
        <>
          <Slider label="Intensidad" value={effect.intensity} min={0} max={1} step={0.05} onChange={(v) => onChange({ intensity: v })} />
          <Slider label="Spread" value={effect.spread} min={0} max={1} step={0.05} onChange={(v) => onChange({ spread: v })} />
        </>
      )}
      {effect.kind === 'posterize' && (
        <Slider label="Niveles" value={effect.levels} min={2} max={8} step={1} onChange={(v) => onChange({ levels: v })} />
      )}
      {effect.kind === 'pixelate' && (
        <Slider label="Tamaño" value={effect.size} min={2} max={40} step={1} onChange={(v) => onChange({ size: v })} />
      )}
      {effect.kind === 'chromatic' && (
        <Slider label="Offset" value={effect.offset} min={0} max={30} step={0.5} onChange={(v) => onChange({ offset: v })} />
      )}
      {effect.kind === 'scanlines' && (
        <>
          <Slider label="Gap" value={effect.gap} min={1} max={20} step={0.5} onChange={(v) => onChange({ gap: v })} />
          <Slider label="Alpha" value={effect.opacity} min={0} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} />
        </>
      )}
      {effect.kind === 'emboss' && (
        <Slider label="Fuerza" value={effect.strength} min={0} max={3} step={0.1} onChange={(v) => onChange({ strength: v })} />
      )}
      {effect.kind === 'sharpen' && (
        <Slider label="Fuerza" value={effect.strength} min={0} max={2} step={0.05} onChange={(v) => onChange({ strength: v })} />
      )}
      {effect.kind === 'overlay-color' && (
        <>
          <Slider label="Alpha" value={effect.opacity} min={0} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} />
          <label style={{ ...swatch, marginTop: 4 }}>
            <span>Color</span>
            <input type="color" value={effect.color} onChange={(ev) => onChange({ color: ev.target.value })} />
          </label>
        </>
      )}
      {effect.kind === 'threshold' && (
        <Slider label="Umbral" value={effect.level} min={0} max={1} step={0.02} onChange={(v) => onChange({ level: v })} />
      )}
      {effect.kind === 'inner-shadow' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <Slider label="X" value={effect.dx} min={-30} max={30} step={1} onChange={(v) => onChange({ dx: v })} />
            <Slider label="Y" value={effect.dy} min={-30} max={30} step={1} onChange={(v) => onChange({ dy: v })} />
          </div>
          <Slider label="Blur" value={effect.blur} min={0} max={40} step={0.5} onChange={(v) => onChange({ blur: v })} />
          <Slider label="Alpha" value={effect.opacity} min={0} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} />
          <label style={{ ...swatch, marginTop: 4 }}>
            <span>Color</span>
            <input type="color" value={effect.color} onChange={(ev) => onChange({ color: ev.target.value })} />
          </label>
        </>
      )}
      {effect.kind === 'gradient-map' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={swatch}><span>Oscuro</span><input type="color" value={effect.dark} onChange={(ev) => onChange({ dark: ev.target.value })} /></label>
          <label style={swatch}><span>Medio</span><input type="color" value={effect.mid} onChange={(ev) => onChange({ mid: ev.target.value })} /></label>
          <label style={swatch}><span>Claro</span><input type="color" value={effect.light} onChange={(ev) => onChange({ light: ev.target.value })} /></label>
        </div>
      )}
      {effect.kind === 'bloom' && (
        <>
          <Slider label="Umbral" value={effect.threshold} min={0} max={1} step={0.02} onChange={(v) => onChange({ threshold: v })} />
          <Slider label="Radio"  value={effect.radius}    min={1} max={40} step={0.5} onChange={(v) => onChange({ radius: v })} />
          <Slider label="Fuerza" value={effect.intensity} min={0} max={2} step={0.05} onChange={(v) => onChange({ intensity: v })} />
        </>
      )}
      {effect.kind === 'outline' && (
        <>
          <Slider label="Grosor" value={effect.width} min={0.5} max={20} step={0.5} onChange={(v) => onChange({ width: v })} />
          <label style={{ ...swatch, marginTop: 4 }}>
            <span>Color</span>
            <input type="color" value={effect.color} onChange={(ev) => onChange({ color: ev.target.value })} />
          </label>
        </>
      )}
      {effect.kind === 'motion-blur' && (
        <>
          <Slider label="Fuerza" value={effect.strength} min={0} max={40} step={0.5} onChange={(v) => onChange({ strength: v })} />
          <Slider label="Ángulo" value={effect.angle}    min={0} max={360} step={5} onChange={(v) => onChange({ angle: v })} />
        </>
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
