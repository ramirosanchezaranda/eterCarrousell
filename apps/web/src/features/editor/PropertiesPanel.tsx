/**
 * Panel de propiedades del bloque seleccionado. Inputs numéricos para
 * x/y/w/h/rotation/zIndex + font size (si es texto). Actualiza el store
 * al blur o Enter. Se muestra pegado al canvas cuando hay selección simple.
 */
import { useEffect, useRef, useState } from 'react';
import { Bold, Copy, Image as ImageIcon, Italic, Lock, Pen, Spline, Strikethrough, Trash2, Underline, Unlock } from 'lucide-react';
import { BRAND } from '@/domain';
import type { GradientFill, PositionedBlock, TextStroke } from '@/domain';
import { useAssetsStore } from '@/state/assetsStore';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';
import { textToPath } from '@/services/textToPath';
import { EffectsPanel } from './EffectsPanel';

interface Props {
  block: PositionedBlock;
  slideId: string;
}

export function PropertiesPanel({ block, slideId }: Props) {
  const update = useProjectStore((s) => s.updateBlock);
  const remove = useProjectStore((s) => s.removeBlock);
  const toggleLock = useProjectStore((s) => s.toggleLock);
  const applyToAll = useProjectStore((s) => s.applyBlockStyleToAllSlides);
  const clear = useUiStore((s) => s.clearSelection);
  const [applyFlash, setApplyFlash] = useState<number | null>(null);

  const patch = (patch: Partial<PositionedBlock>) => update(slideId, block.id, patch);
  const patchRect = (k: 'x' | 'y' | 'w' | 'h', v: number) =>
    patch({ rect: { ...block.rect, [k]: v } });
  const patchShape = (k: string, v: unknown) => {
    if (block.content.kind !== 'shape') return;
    patch({ content: { ...block.content, [k]: v } as PositionedBlock['content'] });
  };
  const patchImage = (k: string, v: unknown) => {
    if (block.content.kind !== 'image') return;
    patch({ content: { ...block.content, [k]: v } as PositionedBlock['content'] });
  };
  const patchDecorOverlay = (k: 'color' | 'opacity', v: unknown) => {
    if (block.content.kind !== 'decor' || !block.content.overlay) return;
    patch({
      content: {
        ...block.content,
        overlay: { ...block.content.overlay, [k]: v } as { color: string; opacity: number },
      } as PositionedBlock['content'],
    });
  };

  return (
    <div style={wrap}>
      <div style={header}>
        <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.55 }}>
          Propiedades · {block.kind}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn onClick={() => toggleLock(slideId, block.id)} title={block.locked ? 'Desbloquear' : 'Bloquear'}>
            {block.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </IconBtn>
          <IconBtn onClick={() => { remove(slideId, block.id); clear(); }} title="Eliminar" danger>
            <Trash2 size={12} />
          </IconBtn>
        </div>
      </div>
      <button
        onClick={() => {
          const n = applyToAll(slideId, block.id);
          setApplyFlash(n);
          setTimeout(() => setApplyFlash(null), 2200);
        }}
        title="Copia estilo y efectos (no el texto ni el rect) a bloques del mismo tipo en las otras slides"
        style={{
          width: '100%', marginBottom: 10, padding: '9px 10px',
          background: applyFlash !== null ? '#4AE29030' : `${BRAND.blue}20`,
          border: `1px solid ${applyFlash !== null ? '#4AE290' : BRAND.blue}`,
          borderRadius: 6, color: BRAND.cream, fontSize: 11, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          letterSpacing: 0.4, transition: 'background 150ms ease',
        }}
      >
        <Copy size={13} />
        {applyFlash !== null
          ? `✓ Aplicado a ${applyFlash} ${applyFlash === 1 ? 'página' : 'páginas'}`
          : 'Aplicar a todas las páginas'}
      </button>
      <div style={row}>
        <Num label="X" value={Math.round(block.rect.x)} onChange={(v) => patchRect('x', v)} />
        <Num label="Y" value={Math.round(block.rect.y)} onChange={(v) => patchRect('y', v)} />
      </div>
      <div style={row}>
        <Num label="W" value={Math.round(block.rect.w)} min={4} onChange={(v) => patchRect('w', v)} />
        <Num label="H" value={Math.round(block.rect.h)} min={4} onChange={(v) => patchRect('h', v)} />
      </div>
      <div style={row}>
        <Num label="Rot" value={Math.round(block.rotation ?? 0)} onChange={(v) => patch({ rotation: v })} suffix="°" />
        <Num label="Z"   value={block.zIndex} onChange={(v) => patch({ zIndex: v })} />
      </div>
      {block.content.kind === 'text' && (
        <TextEditor block={block} slideId={slideId} />
      )}
      {block.content.kind === 'shape' && (
        <>
          <div style={{ ...label, marginTop: 8 }}>Forma · {block.content.shape}</div>
          <div style={row}>
            <ColorInput label="Fill" value={block.content.fill ?? '#000000'} onChange={(v) => patchShape('fill', v)} />
            <ColorInput label="Stroke" value={block.content.stroke ?? '#000000'} onChange={(v) => patchShape('stroke', v)} />
          </div>
          <div style={row}>
            <Num label="Grosor" value={block.content.strokeWidth ?? 0} min={0} max={40} onChange={(v) => patchShape('strokeWidth', v)} />
            <Num label="Opacidad" value={Math.round((block.content.opacity ?? 1) * 100)} min={0} max={100} onChange={(v) => patchShape('opacity', v / 100)} suffix="%" />
          </div>
        </>
      )}
      {block.content.kind === 'image' && (
        <>
          <div style={{ ...label, marginTop: 8 }}>Imagen</div>
          <div style={row}>
            <Select
              label="Fit"
              value={block.content.fit}
              onChange={(v) => patchImage('fit', v)}
              options={[{ v: 'cover', l: 'cover' }, { v: 'contain', l: 'contain' }, { v: 'fill', l: 'fill' }]}
            />
          </div>
        </>
      )}
      {block.content.kind === 'decor' && block.content.overlay && (
        <>
          <div style={{ ...label, marginTop: 8 }}>Overlay del decor</div>
          <div style={row}>
            <ColorInput label="Color" value={block.content.overlay.color} onChange={(v) => patchDecorOverlay('color', v)} />
            <Num label="Alpha" value={Math.round((block.content.overlay.opacity ?? 0) * 100)} min={0} max={100} onChange={(v) => patchDecorOverlay('opacity', v / 100)} suffix="%" />
          </div>
        </>
      )}
      <ReplaceWithImageButton block={block} slideId={slideId} />
      {block.content.kind === 'text' && <VectorizeTextButton block={block} slideId={slideId} />}
      {block.content.kind === 'path' && <PathEditingButtons block={block} />}
      <EffectsPanel block={block} slideId={slideId} />
    </div>
  );
}

/**
 * Convierte cualquier bloque (texto / shape / decor) en uno de kind `image`
 * manteniendo rect + rotation + zIndex. Permite subir archivo o elegir de
 * la galería. Útil para reemplazar rápidamente elementos por fotos.
 */
function ReplaceWithImageButton({ block, slideId }: { block: PositionedBlock; slideId: string }) {
  const update = useProjectStore((s) => s.updateBlock);
  const gallery = useAssetsStore((s) => s.gallery);
  const galleryData = useAssetsStore((s) => s.galleryData);
  const addGalleryImage = useAssetsStore((s) => s.addGalleryImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const applyAsImage = (src: string) => {
    update(slideId, block.id, {
      content: { kind: 'image', src, fit: 'cover' } as PositionedBlock['content'],
    });
    setPickerOpen(false);
  };

  const onFile = async (file: File) => {
    const dataURI = await fileToDataURI(file);
    await addGalleryImage(dataURI, file.name);
    applyAsImage(dataURI);
  };

  return (
    <>
      <button
        onClick={() => setPickerOpen((v) => !v)}
        style={{
          width: '100%', marginTop: 10, padding: '8px 10px',
          background: pickerOpen ? BRAND.blue + '30' : 'transparent',
          border: `1px solid ${BRAND.cream}25`, borderRadius: 6, color: BRAND.cream,
          fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <ImageIcon size={12} /> Reemplazar con imagen
      </button>
      {pickerOpen && (
        <div style={{ marginTop: 6, padding: 8, background: '#0A0A14', border: `1px solid ${BRAND.cream}15`, borderRadius: 6 }}>
          <button
            onClick={() => inputRef.current?.click()}
            style={{ width: '100%', padding: 6, background: BRAND.blue, border: 'none', borderRadius: 4, color: BRAND.cream, fontSize: 10, cursor: 'pointer', marginBottom: 8 }}
          >
            Subir desde archivo...
          </button>
          {gallery.length === 0 ? (
            <div style={{ fontSize: 10, opacity: 0.5, textAlign: 'center', padding: 8 }}>
              Galería vacía. Subí desde arriba o desde Recursos → Galería.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {gallery.map((g) => {
                const du = galleryData[g.id];
                if (!du) return null;
                return (
                  <button
                    key={g.id}
                    onClick={() => applyAsImage(du)}
                    style={{ padding: 0, background: 'transparent', border: `1px solid ${BRAND.cream}15`, borderRadius: 3, cursor: 'pointer', overflow: 'hidden' }}
                  >
                    <img src={du} alt="" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
                  </button>
                );
              })}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </>
  );
}

function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

/**
 * Convierte el bloque de texto actual en un PathContent (SVG path editable).
 * Similar a "Type → Create Outlines" en Illustrator. Preserva color, fill,
 * rect, rotación y zIndex. La primera vez descarga la fuente de Google
 * (2-3 seg); luego queda cacheada.
 */
function VectorizeTextButton({ block, slideId }: { block: PositionedBlock; slideId: string }) {
  const update = useProjectStore((s) => s.updateBlock);
  const customDisplay = useAssetsStore((s) => s.customDisplay);
  const customSans = useAssetsStore((s) => s.customSans);
  const fontGallery = useAssetsStore((s) => s.fontGallery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (block.content.kind !== 'text') return null;
  const c = block.content;

  // Para vectorizar necesitamos una fuente custom subida (ttf/otf/woff1).
  // opentype.js no parsea woff2 y Google Fonts solo sirve woff2 al browser.
  const hasCustomFont =
    !!c.fontFamilyOverride
    || (c.fontRole === 'display' && !!customDisplay)
    || (c.fontRole === 'sans' && !!customSans);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await textToPath({
        text: c.upper ? c.text.toUpperCase() : c.text,
        fontRole: c.fontRole,
        fontFamilyOverride: c.fontFamilyOverride,
        fontSize: c.fontSize,
        rect: block.rect,
        textAlign: c.textAlign,
        customDisplay,
        customSans,
        fontGallery,
      });
      if (!result) {
        setError('No se pudo vectorizar. Subí una fuente .ttf/.otf/.woff en Recursos → Fuentes y asignala como Display o Sans.');
        return;
      }
      update(slideId, block.id, {
        content: {
          kind: 'path',
          d: result.d,
          originalD: result.d,
          fill: c.color,
          sourceText: c.text,
        } as PositionedBlock['content'],
      });
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={run}
        disabled={loading || !hasCustomFont}
        title={hasCustomFont
          ? 'Convierte el texto en contornos SVG editables punto a punto (como "Type → Create Outlines" en Illustrator).'
          : 'Necesita una fuente custom subida (.ttf/.otf/.woff) asignada al rol Display o Sans. Subila en Recursos → Fuentes.'}
        style={{
          width: '100%', marginTop: 10, padding: '8px 10px',
          background: 'transparent', border: `1px solid ${BRAND.cream}25`,
          borderRadius: 6, color: BRAND.cream, fontSize: 11,
          cursor: hasCustomFont && !loading ? 'pointer' : 'not-allowed',
          opacity: hasCustomFont ? 1 : 0.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <Spline size={12} /> {loading ? 'Vectorizando...' : 'Vectorizar texto (contornos)'}
      </button>
      {!hasCustomFont && (
        <div style={{ marginTop: 4, fontSize: 9, opacity: 0.6, lineHeight: 1.4 }}>
          Requiere fuente custom TTF/OTF. Los presets de Google no son compatibles por limitación del browser con woff2.
        </div>
      )}
      {error && <div style={{ marginTop: 6, fontSize: 10, color: '#FF6B6B', lineHeight: 1.4 }}>{error}</div>}
    </>
  );
}

/**
 * Controles cuando el bloque ya es un PathContent.
 * - Toggle "Editar nodos" — muestra los handles drag sobre el canvas.
 * - Restaurar contornos — vuelve al `originalD` guardado al vectorizar.
 */
function PathEditingButtons({ block }: { block: PositionedBlock }) {
  const editingId = useUiStore((s) => s.pathEditingBlockId);
  const setEditingId = useUiStore((s) => s.setPathEditingBlockId);
  const update = useProjectStore((s) => s.updateBlock);
  const currentSlideId = useProjectStore((s) => s.currentSlideId);
  if (block.content.kind !== 'path') return null;
  const isEditing = editingId === block.id;
  const hasOriginal = !!block.content.originalD;

  return (
    <>
      <button
        onClick={() => setEditingId(isEditing ? null : block.id)}
        style={{
          width: '100%', marginTop: 10, padding: '8px 10px',
          background: isEditing ? BRAND.blue : 'transparent',
          border: `1px solid ${isEditing ? BRAND.blue : BRAND.cream + '25'}`,
          borderRadius: 6, color: BRAND.cream, fontSize: 11, fontWeight: isEditing ? 700 : 400,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <Pen size={12} /> {isEditing ? 'Salir modo edición de nodos' : 'Editar nodos del contorno'}
      </button>
      {hasOriginal && block.content.kind === 'path' && block.content.d !== block.content.originalD && (
        <button
          onClick={() => {
            if (block.content.kind !== 'path' || !block.content.originalD) return;
            update(currentSlideId, block.id, {
              content: { ...block.content, d: block.content.originalD } as PositionedBlock['content'],
            });
          }}
          style={{
            width: '100%', marginTop: 6, padding: '6px 10px',
            background: 'transparent', border: `1px solid ${BRAND.cream}20`,
            borderRadius: 4, color: BRAND.cream, fontSize: 10, cursor: 'pointer', opacity: 0.8,
          }}
        >
          Restaurar contornos originales
        </button>
      )}
    </>
  );
}

function Num({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min?: number; max?: number; step?: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = () => {
    const n = Number(text);
    if (!isNaN(n)) onChange(n);
    else setText(String(value));
  };
  return (
    <label style={inputWrap}>
      <span style={label === 'Rot' ? labelTiny : labelStyle}>{label}{suffix ? ` ${suffix}` : ''}</span>
      <input
        type="number"
        value={text}
        min={min} max={max} step={step}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
        style={numInput}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ v: string; l: string }>;
}) {
  return (
    <label style={inputWrap}>
      <span style={labelStyle}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={numInput}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={inputWrap}>
      <span style={labelStyle}>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ ...numInput, padding: 2, height: 28 }} />
    </label>
  );
}

/**
 * Editor tipográfico avanzado tipo SVG rich text:
 *   - toolbar B / I / U / S (bold, italic, underline, line-through)
 *   - fontSize, weight, align
 *   - color fill plano o gradiente lineal de 2 stops con slider de ángulo
 *   - stroke (contorno SVG) con color + width
 */
function TextEditor({ block, slideId }: { block: PositionedBlock; slideId: string }) {
  const update = useProjectStore((s) => s.updateBlock);
  if (block.content.kind !== 'text') return null;
  const c = block.content;

  const patchText = (k: string, v: unknown) => {
    update(slideId, block.id, { content: { ...c, [k]: v } as PositionedBlock['content'] });
  };

  const toggle = (k: 'underline' | 'strike') => patchText(k, !c[k]);
  const toggleBold = () => patchText('fontWeight', (c.fontWeight ?? 400) >= 600 ? 400 : 700);
  const toggleItalic = () => patchText('fontStyle', c.fontStyle === 'italic' ? 'normal' : 'italic');

  const isBold = (c.fontWeight ?? 400) >= 600;
  const isItalic = c.fontStyle === 'italic';
  const hasGradient = !!c.gradientFill;
  const hasStroke = !!c.stroke;

  const setStrokeEnabled = (v: boolean) => {
    patchText('stroke', v ? ({ color: '#000000', width: 2 } satisfies TextStroke) : undefined);
  };
  const patchStroke = (patch: Partial<TextStroke>) => {
    if (!c.stroke) return;
    patchText('stroke', { ...c.stroke, ...patch });
  };

  const setGradientEnabled = (v: boolean) => {
    patchText('gradientFill', v
      ? ({ angle: 135, stops: [{ color: c.color, at: 0 }, { color: '#F1E8D3', at: 1 }] } satisfies GradientFill)
      : undefined);
  };
  const patchGradient = (patch: Partial<GradientFill>) => {
    if (!c.gradientFill) return;
    patchText('gradientFill', { ...c.gradientFill, ...patch });
  };
  const patchGradientStop = (idx: number, patch: Partial<{ color: string; at: number }>) => {
    if (!c.gradientFill) return;
    const stops = c.gradientFill.stops.map((s, i) => i === idx ? { ...s, ...patch } : s);
    patchText('gradientFill', { ...c.gradientFill, stops });
  };

  return (
    <>
      <div style={{ ...label, marginTop: 8 }}>Texto</div>
      <textarea
        value={c.text}
        onChange={(e) => patchText('text', e.target.value)}
        rows={2}
        style={textareaStyle}
      />

      {/* Toolbar B / I / U / S */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        <ToggleBtn active={isBold}      onClick={toggleBold}      title="Bold (Ctrl+B)"><Bold size={13} /></ToggleBtn>
        <ToggleBtn active={isItalic}    onClick={toggleItalic}    title="Italic (Ctrl+I)"><Italic size={13} /></ToggleBtn>
        <ToggleBtn active={!!c.underline} onClick={() => toggle('underline')} title="Subrayar (Ctrl+U)"><Underline size={13} /></ToggleBtn>
        <ToggleBtn active={!!c.strike}  onClick={() => toggle('strike')} title="Tachar"><Strikethrough size={13} /></ToggleBtn>
      </div>

      <div style={row}>
        <Num label="Size" value={Math.round(c.fontSize)} min={8} onChange={(v) => patchText('fontSize', v)} />
        <Num label="Peso" value={c.fontWeight ?? 400} min={100} max={900} step={100} onChange={(v) => patchText('fontWeight', v)} />
      </div>
      <div style={row}>
        <Select
          label="Align"
          value={c.textAlign}
          onChange={(v) => patchText('textAlign', v)}
          options={[{ v: 'start', l: 'Izq' }, { v: 'middle', l: 'Centro' }, { v: 'end', l: 'Der' }]}
        />
        <Num label="Tracking" value={c.letterSpacing ?? 0} min={-20} max={40} step={0.5} onChange={(v) => patchText('letterSpacing', v)} />
      </div>

      {/* Fill sólido — visible solo si no hay gradient activo */}
      {!hasGradient && (
        <div style={{ ...row, marginTop: 4 }}>
          <ColorInput label="Color" value={c.color} onChange={(v) => patchText('color', v)} />
          <label style={{ ...inputWrap, justifyContent: 'flex-end' }}>
            <span style={labelStyle}>Upper</span>
            <button
              onClick={() => patchText('upper', !c.upper)}
              style={{ ...numInput, cursor: 'pointer', textAlign: 'center', background: c.upper ? BRAND.blue : '#0A0A14' }}
            >
              {c.upper ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
      )}

      {/* Gradient fill */}
      <FieldToggle label="Gradient fill" active={hasGradient} onChange={setGradientEnabled}>
        {c.gradientFill && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 4px' }}>
              <span style={{ fontSize: 9, opacity: 0.5, width: 50 }}>Ángulo</span>
              <input
                type="range" min={0} max={360} value={c.gradientFill.angle}
                onChange={(e) => patchGradient({ angle: Number(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 10, fontFamily: 'monospace', width: 30, textAlign: 'right' }}>{c.gradientFill.angle}°</span>
            </div>
            {c.gradientFill.stops.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                <input type="color" value={s.color} onChange={(e) => patchGradientStop(i, { color: e.target.value })} style={{ width: 34, height: 22, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                <input
                  type="range" min={0} max={1} step={0.05} value={s.at}
                  onChange={(e) => patchGradientStop(i, { at: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 10, fontFamily: 'monospace', width: 30, textAlign: 'right' }}>{Math.round(s.at * 100)}%</span>
              </div>
            ))}
          </>
        )}
      </FieldToggle>

      {/* Stroke / contorno */}
      <FieldToggle label="Contorno (stroke)" active={hasStroke} onChange={setStrokeEnabled}>
        {c.stroke && (
          <div style={row}>
            <ColorInput label="Color" value={c.stroke.color} onChange={(v) => patchStroke({ color: v })} />
            <Num label="Grosor" value={c.stroke.width} min={0} max={30} step={0.5} onChange={(v) => patchStroke({ width: v })} />
          </div>
        )}
      </FieldToggle>
    </>
  );
}

function ToggleBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        flex: 1, padding: '6px 0',
        background: active ? BRAND.blue : '#0A0A14',
        border: `1px solid ${active ? BRAND.blue : BRAND.cream + '20'}`,
        borderRadius: 4, color: BRAND.cream, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function FieldToggle({ label, active, onChange, children }: { label: string; active: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8, padding: 8, background: '#0A0A14', borderRadius: 4, border: `1px solid ${BRAND.cream}15` }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11 }}>
        <input type="checkbox" checked={active} onChange={(e) => onChange(e.target.checked)} />
        <span style={{ flex: 1 }}>{label}</span>
      </label>
      {active && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent', border: `1px solid ${BRAND.cream}25`,
        color: danger ? '#FF6B6B' : BRAND.cream, borderRadius: 4, padding: 5, cursor: 'pointer',
        display: 'flex', alignItems: 'center',
      }}
    >
      {children}
    </button>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 12, padding: 10, background: '#14141E',
  border: `1px solid ${BRAND.blue}40`, borderRadius: 6,
};
const header: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
};
const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 };
const inputWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
const labelStyle: React.CSSProperties = { fontSize: 9, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 1 };
const labelTiny: React.CSSProperties = { ...labelStyle, fontSize: 9 };
const label: React.CSSProperties = { ...labelStyle, marginBottom: 4 };
const numInput: React.CSSProperties = {
  background: '#0A0A14', border: `1px solid ${BRAND.cream}20`, color: BRAND.cream,
  borderRadius: 4, padding: '5px 8px', fontSize: 11, fontFamily: 'monospace', width: '100%',
};
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: 8, background: '#0A0A14', border: `1px solid ${BRAND.cream}20`,
  borderRadius: 4, color: BRAND.cream, fontFamily: 'inherit', fontSize: 11, resize: 'vertical', marginBottom: 6,
};
