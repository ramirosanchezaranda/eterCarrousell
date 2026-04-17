// @ts-nocheck
/**
 * Archivo legacy — App monolítica del `index.jsx` original, ya adelgazada
 * tras los hitos 2–4 (dominio, UI, primitivos y slides extraídos).
 * Sobrevive: `getLayout()` legacy (reemplazada en hito 8), `generateCarousel`
 * (reemplazada por BFF en hito 6) y la `LegacyCarouselApp` principal.
 * Se elimina en el hito 16 del plan v2.
 */
import { useState, useRef, useMemo } from 'react';
import {
  Sparkles, Download, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Package, Image as ImageIcon, Type, Grid3x3, FileText,
} from 'lucide-react';
import {
  BRAND, CANVAS, SPACING, SAFE, FONT_PRESETS, GRID_PRESETS, DEFAULT_SLIDES, DEFAULT_TOPIC,
} from '@/domain';
import type {
  BrandAssets, CustomFont, LegacyLayout, LegacySlide as Slide, ResolvedFonts, SlideType, TemplateId as GridPreset,
} from '@/domain';
import { svgToBlob, downloadBlob } from '@/services/exporter';
import { ImageUploader, FontUploader, GridThumb } from '@/ui';
import { SlideView } from '@/render/SlideView';

// ============================================================
// LAYOUT LEGACY (el motor viejo; reemplazado en el hito 8)
// ============================================================
function getLayout(grid: GridPreset, slideType: SlideType): LegacyLayout {
  const W = CANVAS.W, H = CANVAS.H;
  const isQuote = slideType === 'quote';

  switch (grid) {
    case 'editorial':
      return {
        decorRect: { x: W * 0.52, y: 0, w: W * 0.48, h: H * 0.63 }, decorDensity: 1,
        textX: SAFE.left, textY: 220, textAlign: 'start', textMaxChars: 13, textSize: 1,
        logoX: SAFE.left, logoAlign: 'left', logoOnDark: isQuote ? true : (slideType === 'contrast'),
        bgBase: isQuote ? 'blue' : 'cream',
        accent: slideType === 'contrast' ? { x: 0, y: 820, w: 560, h: H - 820 } : undefined,
      };
    case 'centered':
      return {
        decorRect: { x: 0, y: 0, w: W, h: 220 }, decorDensity: 0.5,
        textX: W / 2, textY: H / 2 - 150, textAlign: 'middle', textMaxChars: 16, textSize: 1,
        logoX: W / 2, logoAlign: 'center', logoOnDark: isQuote,
        bgBase: isQuote ? 'blue' : 'cream',
        accent: slideType === 'contrast' ? { x: 0, y: H - 400, w: W, h: 400 } : undefined,
      };
    case 'asymmetric':
      return {
        decorRect: { x: 0, y: 0, w: W * 0.5, h: H }, decorDensity: 1,
        textX: W * 0.55, textY: H * 0.35, textAlign: 'start', textMaxChars: 12, textSize: 0.85,
        logoX: W * 0.55, logoAlign: 'left', logoOnDark: false, bgBase: 'cream',
      };
    case 'split-v':
      return {
        decorRect: { x: 0, y: 0, w: W, h: H / 2 }, decorDensity: 1,
        textX: W / 2, textY: H * 0.62, textAlign: 'middle', textMaxChars: 16, textSize: 0.95,
        logoX: W / 2, logoAlign: 'center', logoOnDark: false, bgBase: 'cream',
      };
    case 'split-h':
      return {
        decorRect: { x: 0, y: 0, w: W / 2, h: H }, decorDensity: 1,
        textX: W / 2 + SPACING.lg, textY: H * 0.3, textAlign: 'start', textMaxChars: 12, textSize: 0.85,
        logoX: W / 2 + SPACING.lg, logoAlign: 'left', logoOnDark: false, bgBase: 'cream',
      };
    case 'magazine':
      return {
        decorRect: { x: 0, y: 0, w: W * 0.28, h: H }, decorDensity: 1,
        textX: W * 0.32, textY: 240, textAlign: 'start', textMaxChars: 18, textSize: 0.9,
        logoX: W * 0.32, logoAlign: 'left', logoOnDark: false, bgBase: 'cream',
      };
    case 'frame':
      return {
        decorRect: { x: 80, y: 80, w: W - 160, h: H - 160 }, decorDensity: 0.8,
        overlay: { color: BRAND.cream, opacity: 0.88 },
        textX: W / 2, textY: H / 2 - 150, textAlign: 'middle', textMaxChars: 14, textSize: 0.95,
        logoX: W / 2, logoAlign: 'center', logoOnDark: false, bgBase: 'cream',
      };
    case 'fullbleed':
      return {
        decorRect: { x: 0, y: 0, w: W, h: H }, decorDensity: 1,
        overlay: { color: BRAND.ink, opacity: 0.55 },
        textX: W / 2, textY: H / 2 - 180, textAlign: 'middle', textMaxChars: 15, textSize: 1,
        logoX: W / 2, logoAlign: 'center', logoOnDark: true, bgBase: 'decor',
      };
    case 'minimal':
      return {
        decorRect: { x: W - 300, y: H - 300, w: 220, h: 220 }, decorDensity: 1,
        textX: SAFE.left, textY: H * 0.4, textAlign: 'start', textMaxChars: 18, textSize: 0.75,
        logoX: SAFE.left, logoAlign: 'left', logoOnDark: false, bgBase: 'cream',
      };
    case 'poster':
      return {
        decorRect: { x: 0, y: H - 280, w: W, h: 280 }, decorDensity: 0.9,
        textX: W / 2, textY: 260, textAlign: 'middle', textMaxChars: 14, textSize: 1.15,
        logoX: W / 2, logoAlign: 'center', logoOnDark: false, bgBase: 'cream',
      };
  }
}

// ============================================================
// CLAUDE API (se reemplaza por BFF en el hito 6)
// ============================================================
async function generateCarousel(topic: string): Promise<Slide[]> {
  const prompt = `Sos el copywriter senior de eterCore, agencia de diseño web en LATAM. Tono de amigo inteligente en un café, no motivador de LinkedIn.

Carrusel de Instagram de 6 slides sobre: "${topic}"

ESTRUCTURA:
1. "cover" — hook de 5-9 palabras
2. "observation" — pensamiento conversacional 15-22 palabras
3. "contrast" — afirmación 11-15 palabras + contraste 6-9 palabras (único con paralelismo)
4. "quote" — insight central 10-16 palabras
5. "stat" — número con caption 10-16 palabras. Si no hay dato verificable: "7 de 10" con caption "OBSERVACIÓN INTERNA · ETERCORE". Nunca inventes fuentes reales.
6. "cta" — line1 8-12 palabras + line2 acción corta máx 6 palabras

MALOS: "Una identidad no se diseña. Se decide." | "No es X, es Y" | paralelismo fuera del 3 | "En un mundo donde..."
BUENOS: "Tu web es el primer empleado que conocen." | "Hay empresas que facturan millones y tienen la web de un Excel de 2014."

Concreto > abstracto. Variá ritmo. Prohibido: sinergia, engagement, disrupción, hashtags, emojis.

SOLO JSON array:
[{"type":"cover","line1":"..."},{"type":"observation","line1":"..."},{"type":"contrast","line1":"...","line2":"..."},{"type":"quote","line1":"..."},{"type":"stat","number":"...","line1":"...","caption":"..."},{"type":"cta","line1":"...","line2":"..."}]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await response.json();
  let text = data.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').replace(/```json|```/g, '').trim();
  const start = text.indexOf('['); const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('Response is not an array');
  return parsed;
}

// ============================================================
// APP PRINCIPAL
// ============================================================
type TabKey = 'content' | 'brand' | 'assets' | 'grid';

export function LegacyCarouselApp() {
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [seed, setSeed] = useState(42);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('content');

  const [logo, setLogo] = useState<string | null>(null);
  const [decorA, setDecorA] = useState<string | null>(null);
  const [decorB, setDecorB] = useState<string | null>(null);
  const [gridRef, setGridRef] = useState<string | null>(null);
  const [fontKey, setFontKey] = useState<string>('fraunces');
  const [gridPreset, setGridPreset] = useState<GridPreset>('editorial');
  const [customDisplay, setCustomDisplay] = useState<CustomFont | null>(null);
  const [customSans, setCustomSans] = useState<CustomFont | null>(null);

  const svgWrapRef = useRef<HTMLDivElement>(null);

  const resolvedFonts: ResolvedFonts = useMemo(() => {
    const preset = FONT_PRESETS[fontKey];
    return {
      display: customDisplay ? `"${customDisplay.internalName}", ${preset.display}` : preset.display,
      sans: customSans ? `"${customSans.internalName}", ${preset.sans}` : preset.sans,
      script: preset.script, mono: preset.mono,
    };
  }, [fontKey, customDisplay, customSans]);

  const customFonts = useMemo(() => {
    const list: CustomFont[] = [];
    if (customDisplay) list.push(customDisplay);
    if (customSans) list.push(customSans);
    return list;
  }, [customDisplay, customSans]);

  const assets: BrandAssets = { logo, decorA, decorB, gridRef, fonts: resolvedFonts, customFonts, grid: gridPreset };

  const handleGenerate = async () => {
    setLoading(true); setError(null);
    try { const r = await generateCarousel(topic); setSlides(r); setSeed(Math.floor(Math.random() * 99999)); setCurrentIdx(0); }
    catch (e: any) { setError('Falló la generación.'); console.error(e); }
    finally { setLoading(false); }
  };

  const handleDownloadCurrent = async () => {
    const svg = svgWrapRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;
    const blob = await svgToBlob(svg, { fonts: customFonts });
    await downloadBlob(blob, `etercore-${String(currentIdx + 1).padStart(2, '0')}.jpg`);
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        setCurrentIdx(i);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const svg = svgWrapRef.current?.querySelector('svg') as SVGSVGElement | null;
        if (!svg) continue;
        const blob = await svgToBlob(svg, { fonts: customFonts });
        await downloadBlob(blob, `etercore-${String(i + 1).padStart(2, '0')}.jpg`);
      }
    } finally { setDownloading(false); }
  };

  const currentSlide = slides[currentIdx];
  const currentLayout = getLayout(gridPreset, currentSlide.type);
  const tabs: Array<{ key: TabKey; label: string; icon: any }> = [
    { key: 'content', label: 'Contenido', icon: FileText }, { key: 'brand', label: 'Marca', icon: Type },
    { key: 'assets', label: 'Assets', icon: ImageIcon }, { key: 'grid', label: 'Grilla', icon: Grid3x3 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A14', color: BRAND.cream, fontFamily: FONT_PRESETS.fraunces.sans }}>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${FONT_PRESETS[fontKey].googleFamilies.split('|').join('&family=')}&display=swap`} />

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32, padding: 32, maxWidth: 1600, margin: '0 auto' }}>
        <aside style={{ position: 'sticky', top: 32, alignSelf: 'start', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto' }}>
          <h1 style={{ fontFamily: resolvedFonts.display, fontSize: 32, fontStyle: 'italic', margin: 0, color: BRAND.cream, lineHeight: 1.1 }}>
            eterCore <span style={{ color: BRAND.blue }}>/ studio</span>
          </h1>
          <div style={{ display: 'flex', gap: 4, marginTop: 20, padding: 4, background: '#14141E', borderRadius: 8 }}>
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{ flex: 1, padding: '10px 8px', background: activeTab === key ? BRAND.blue : 'transparent', border: 'none', borderRadius: 5, color: BRAND.cream, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, textTransform: 'uppercase' }}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            {activeTab === 'content' && (
              <>
                <label style={{ display: 'block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7 }}>Tema</label>
                <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} style={{ width: '100%', marginTop: 8, padding: 14, background: '#14141E', border: `1px solid ${BRAND.blue}40`, borderRadius: 6, color: BRAND.cream, fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
                <button onClick={handleGenerate} disabled={loading || downloading} style={{ width: '100%', marginTop: 10, padding: '14px 18px', background: BRAND.blue, border: 'none', borderRadius: 6, color: BRAND.cream, fontWeight: 700, fontSize: 13, letterSpacing: 1, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} {loading ? 'GENERANDO...' : 'GENERAR CON CLAUDE'}
                </button>
                <button onClick={() => setSeed(Math.floor(Math.random() * 99999))} style={{ width: '100%', marginTop: 8, padding: '10px 14px', background: 'transparent', border: `1px solid ${BRAND.cream}30`, borderRadius: 6, color: BRAND.cream, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <RefreshCw size={12} /> Regenerar textura
                </button>
                <button onClick={handleDownloadCurrent} disabled={downloading} style={{ width: '100%', marginTop: 12, padding: '12px 18px', background: BRAND.cream, border: 'none', borderRadius: 6, color: BRAND.ink, fontWeight: 700, fontSize: 12, letterSpacing: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Download size={13} /> DESCARGAR SLIDE ACTUAL
                </button>
                <button onClick={handleDownloadAll} disabled={downloading || loading} style={{ width: '100%', marginTop: 6, padding: '12px 18px', background: BRAND.ink, border: `1px solid ${BRAND.blue}`, borderRadius: 6, color: BRAND.cream, fontWeight: 700, fontSize: 12, letterSpacing: 1, cursor: downloading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {downloading ? <Loader2 size={13} className="spin" /> : <Package size={13} />} {downloading ? `DESCARGANDO ${currentIdx + 1}/${slides.length}...` : `DESCARGAR LOS ${slides.length}`}
                </button>
                {error && <div style={{ marginTop: 14, padding: 10, background: '#4A1515', borderRadius: 4, fontSize: 12 }}>{error}</div>}
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.5, marginBottom: 10 }}>Slides</div>
                  {slides.map((s, i) => (
                    <button key={i} onClick={() => setCurrentIdx(i)} style={{ width: '100%', textAlign: 'left', marginBottom: 4, padding: '10px 12px', background: i === currentIdx ? `${BRAND.blue}30` : 'transparent', border: `1px solid ${i === currentIdx ? BRAND.blue : BRAND.cream + '15'}`, borderRadius: 4, color: BRAND.cream, fontSize: 12, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: FONT_PRESETS.fraunces.mono, opacity: 0.5, fontSize: 11 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ fontFamily: FONT_PRESETS.fraunces.mono, fontSize: 10, opacity: 0.6, textTransform: 'uppercase', minWidth: 68 }}>{s.type}</span>
                      <span style={{ fontSize: 11, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.line1}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'brand' && (
              <>
                <ImageUploader value={logo} onChange={setLogo} label="Logo" height={100} />
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 8, marginTop: 18 }}>Preset tipográfico</div>
                {Object.entries(FONT_PRESETS).map(([key, preset]) => (
                  <button key={key} onClick={() => setFontKey(key)} style={{ width: '100%', marginBottom: 6, padding: 12, background: fontKey === key ? `${BRAND.blue}30` : '#14141E', border: `1px solid ${fontKey === key ? BRAND.blue : BRAND.cream + '15'}`, borderRadius: 6, color: BRAND.cream, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontFamily: preset.display, fontSize: 22, fontStyle: 'italic', color: BRAND.blue, marginBottom: 2 }}>Aa</div>
                    <div style={{ fontSize: 11, opacity: 0.7, fontFamily: preset.sans }}>{preset.label}</div>
                  </button>
                ))}
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${BRAND.cream}15` }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Fuentes propias</div>
                  <p style={{ fontSize: 11, opacity: 0.5, marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>Override el preset. Se embeben en el export.</p>
                  <FontUploader value={customDisplay} onChange={setCustomDisplay} label="Display" slotName="cdisplay" />
                  <FontUploader value={customSans} onChange={setCustomSans} label="Sans" slotName="csans" />
                </div>
              </>
            )}

            {activeTab === 'assets' && (
              <>
                <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>Se alternan entre slides (A pares, B impares).</p>
                <ImageUploader value={decorA} onChange={setDecorA} label="Imagen decorativa A" height={140} />
                <ImageUploader value={decorB} onChange={setDecorB} label="Imagen decorativa B" height={140} />
              </>
            )}

            {activeTab === 'grid' && (
              <>
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 10 }}>10 presets de grilla</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 20 }}>
                  {GRID_PRESETS.map((p) => <GridThumb key={p} preset={p} layout={getLayout(p, 'cover')} active={gridPreset === p} onClick={() => setGridPreset(p)} />)}
                </div>
                <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 6, marginTop: 20 }}>Referencia (opcional)</div>
                <p style={{ fontSize: 11, opacity: 0.5, marginBottom: 10, lineHeight: 1.5 }}>Próxima iteración: Claude Vision analiza y crea preset custom.</p>
                <ImageUploader value={gridRef} onChange={setGridRef} label="Imagen de referencia" height={140} />
              </>
            )}
          </div>
        </aside>

        <main>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
            <button onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0} style={{ background: 'transparent', border: `1px solid ${BRAND.cream}30`, color: BRAND.cream, padding: 8, borderRadius: 4, cursor: 'pointer', display: 'flex' }}><ChevronLeft size={16} /></button>
            <span style={{ fontFamily: resolvedFonts.mono, fontSize: 12, opacity: 0.6, minWidth: 220, textAlign: 'center' }}>
              {String(currentIdx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')} — {currentSlide.type} — {gridPreset}
            </span>
            <button onClick={() => setCurrentIdx((i) => Math.min(slides.length - 1, i + 1))} disabled={currentIdx === slides.length - 1} style={{ background: 'transparent', border: `1px solid ${BRAND.cream}30`, color: BRAND.cream, padding: 8, borderRadius: 4, cursor: 'pointer', display: 'flex' }}><ChevronRight size={16} /></button>
          </div>
          <div ref={svgWrapRef} style={{ maxWidth: 560, margin: '0 auto', boxShadow: '0 30px 80px rgba(46, 70, 200, 0.3)', borderRadius: 8, overflow: 'hidden' }}>
            <SlideView slide={currentSlide} layout={currentLayout} seed={seed + currentIdx * 1000} index={currentIdx} total={slides.length} assets={assets} />
          </div>
          <p style={{ textAlign: 'center', opacity: 0.4, fontSize: 11, marginTop: 12 }}>1080 × 1350 · {gridPreset} · {FONT_PRESETS[fontKey].label}</p>
        </main>
      </div>

      <style>{`
        .spin { animation: legacy-spin 1s linear infinite; }
        @keyframes legacy-spin { to { transform: rotate(360deg); } }
        button:disabled { opacity: 0.5; cursor: not-allowed !important; }
        aside::-webkit-scrollbar { width: 6px; }
        aside::-webkit-scrollbar-thumb { background: ${BRAND.blue}40; border-radius: 3px; }
      `}</style>
    </div>
  );
}

export default LegacyCarouselApp;
