/**
 * Shell del editor: monta Sidebar + EditorCanvas + topbar (undo/redo + export).
 * Es el componente root del nuevo editor (reemplaza al LegacyCarouselApp en App.tsx).
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Keyboard, Package, Redo2, Undo2, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { BRAND } from '@/domain';
import { FORMATS } from '@/formats';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';
import { useAssetsStore } from '@/state/assetsStore';
import { svgToBlob, downloadBlob } from '@/services/exporter';
import { collectActiveFontCss } from '@/services/fontEmbed';
import { EditorCanvas } from './EditorCanvas';
import { EditorSidebar } from './EditorSidebar';
import { PropertiesColumn } from './PropertiesColumn';
import { useKeyboardShortcuts, smartUndo, smartRedo } from './useKeyboardShortcuts';
import { ShortcutsHelp } from './ShortcutsHelp';

export function EditorShell() {
  const project = useProjectStore();
  const ui = useUiStore();
  const assets = useAssetsStore();
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Hidrata dataURIs desde IndexedDB al montar. Hace que el logo,
  // decores e imágenes subidas en sesiones previas reaparezcan en la UI.
  useEffect(() => {
    void assets.hydrateFromIdb();
  }, [assets]);

  // Sincroniza assets → bloques de las slides existentes. Cada vez que
  // el usuario sube (o elimina) logo/decor, los bloques decor y logo
  // del carrusel se actualizan en sitio sin tocar posiciones.
  const logoDataURI = assets.logoDataURI;
  const decorADataURI = assets.decorADataURI;
  const decorBDataURI = assets.decorBDataURI;
  useEffect(() => {
    if (!assets.hydrated) return;
    if (project.slides.length === 0) return;
    // Pausa el history de zundo: la sincronización automática de assets →
    // bloques NO es una acción del usuario, no debe ocupar un slot de undo.
    const t = useProjectStore.temporal.getState();
    t.pause();
    project.applyAssetsToAllSlides({
      logoSrc: logoDataURI,
      decorASrc: decorADataURI,
      decorBSrc: decorBDataURI,
    });
    t.resume();
    // No depender de `project` para no crear loops cuando slides cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoDataURI, decorADataURI, decorBDataURI, assets.hydrated]);
  const format = FORMATS[project.formatId];
  const slides = project.slides;
  const currentIdx = Math.max(0, slides.findIndex((s) => s.id === project.currentSlideId));
  const currentSlide = slides[currentIdx];

  const handleUndo = () => smartUndo();
  const handleRedo = () => smartRedo();

  /**
   * Recolecta todas las fuentes activas (custom + Google preset) como CSS
   * `@font-face{...}` listo para inyectar en el SVG exportado.
   * La primera llamada tarda unos segundos (fetch de Google Fonts); las
   * siguientes son instantáneas por cache en memoria.
   */
  const collectFonts = async (): Promise<string> => {
    return collectActiveFontCss({
      fontKey: assets.fontKey,
      customDisplay: assets.customDisplay,
      customSans: assets.customSans,
      customDisplayDataURI: assets.customDisplayDataURI,
      customSansDataURI: assets.customSansDataURI,
      fontGallery: assets.fontGallery,
    });
  };

  const handleDownloadCurrent = async () => {
    const svg = canvasWrapRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;
    ui.setDownloading(true);
    try {
      const fontCss = await collectFonts();
      const blob = await svgToBlob(svg, {
        format: 'jpeg',
        quality: 0.95,
        width: format.width,
        height: format.height,
        backgroundColor: assets.theme.colors.bg,
        fontCss,
      });
      await downloadBlob(blob, `carrousel-${String(currentIdx + 1).padStart(2, '0')}.jpg`);
    } finally { ui.setDownloading(false); }
  };

  const handleDownloadAll = async () => {
    ui.setDownloading(true);
    try {
      // Cargamos fuentes una sola vez — se cachean para las siguientes slides.
      const fontCss = await collectFonts();
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (!slide) continue;
        project.setCurrentSlideId(slide.id);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const svg = canvasWrapRef.current?.querySelector('svg') as SVGSVGElement | null;
        if (!svg) continue;
        const blob = await svgToBlob(svg, {
          format: 'jpeg', quality: 0.95,
          width: format.width, height: format.height,
          backgroundColor: assets.theme.colors.bg,
          fontCss,
        });
        await downloadBlob(blob, `carrousel-${String(i + 1).padStart(2, '0')}.jpg`);
      }
    } finally { ui.setDownloading(false); }
  };

  const goPrev = () => { const p = slides[currentIdx - 1]; if (p) project.setCurrentSlideId(p.id); };
  const goNext = () => { const n = slides[currentIdx + 1]; if (n) project.setCurrentSlideId(n.id); };

  // Atajos de teclado. Pasa handlers de export para Ctrl+S / Ctrl+Shift+S.
  // Se declara al final para que los handlers arriba ya estén inicializados.
  const handleZoomIn  = () => ui.setZoom(Math.min(4,    ui.zoom * 1.25));
  const handleZoomOut = () => ui.setZoom(Math.max(0.25, ui.zoom / 1.25));
  const handleResetView = () => ui.resetView();

  useKeyboardShortcuts({
    downloadCurrent: () => void handleDownloadCurrent(),
    downloadAll: () => void handleDownloadAll(),
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A14', color: BRAND.cream, fontFamily: assets.theme.fonts.sans }}>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${assets.theme.fonts.googleFamilies.split('|').join('&family=')}&display=swap`} />
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr 340px', gap: 20, padding: 20, maxWidth: 2000, margin: '0 auto', alignItems: 'start' }}>
        <EditorSidebar />
        <main>
          <TopBar
            currentIdx={currentIdx}
            total={slides.length}
            onPrev={goPrev}
            onNext={goNext}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onDownloadCurrent={handleDownloadCurrent}
            onDownloadAll={handleDownloadAll}
            onShowHelp={() => ui.setShowShortcutsHelp(true)}
            downloading={ui.downloading}
            subtitle={currentSlide ? `${currentSlide.type} — ${currentSlide.templateId} — ${format.label}` : format.label}
            zoom={ui.zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleResetView}
            onZoomSet={(z) => ui.setZoom(z)}
          />
          <div ref={canvasWrapRef}>
            <EditorCanvas />
          </div>
          {ui.warnings.length > 0 && <WarningsPanel />}
          <ShortcutsHelp />
          {ui.showAutoFixToast && (
            <div style={{ position: 'fixed', bottom: 24, right: 24, background: BRAND.blue, color: BRAND.cream, padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              Diseño auto-ajustado
            </div>
          )}
        </main>
        <PropertiesColumn />
      </div>
      <style>{`
        button:disabled { opacity: 0.5; cursor: not-allowed !important; }
        aside::-webkit-scrollbar { width: 6px; }
        aside::-webkit-scrollbar-thumb { background: ${BRAND.blue}40; border-radius: 3px; }
      `}</style>
    </div>
  );
}

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2];

function TopBar(props: {
  currentIdx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownloadCurrent: () => void;
  onDownloadAll: () => void;
  onShowHelp: () => void;
  downloading: boolean;
  subtitle: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomSet: (z: number) => void;
}) {
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const zoomPct = Math.round(props.zoom * 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <IconButton onClick={props.onUndo} title="Deshacer (Ctrl+Z)"><Undo2 size={14} /></IconButton>
        <IconButton onClick={props.onRedo} title="Rehacer (Ctrl+Y)"><Redo2 size={14} /></IconButton>
        <IconButton onClick={props.onShowHelp} title="Atajos de teclado (?)"><Keyboard size={14} /></IconButton>
        {/* ── Zoom controls ── */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', borderLeft: `1px solid ${BRAND.cream}20`, paddingLeft: 8, marginLeft: 4 }}>
          <IconButton onClick={props.onZoomOut} title="Zoom out (Ctrl+-)"><ZoomOut size={14} /></IconButton>
          {/* Clickable zoom % → opens preset menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setZoomMenuOpen((o) => !o)}
              title="Zoom (click para presets)"
              style={{
                background: 'transparent', border: `1px solid ${BRAND.cream}30`, color: BRAND.cream,
                padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace',
                fontSize: 11, minWidth: 46, textAlign: 'center',
              }}
            >
              {zoomPct}%
            </button>
            {zoomMenuOpen && (
              <div
                style={{
                  position: 'absolute', top: '110%', left: 0, zIndex: 9999,
                  background: '#14141E', border: `1px solid ${BRAND.blue}40`,
                  borderRadius: 6, overflow: 'hidden', minWidth: 90,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                {ZOOM_PRESETS.map((z) => (
                  <button
                    key={z}
                    onClick={() => { props.onZoomSet(z); setZoomMenuOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 12px', background: z === props.zoom ? `${BRAND.blue}40` : 'transparent',
                      border: 'none', color: BRAND.cream, fontSize: 12, cursor: 'pointer',
                      fontFamily: 'monospace',
                    }}
                  >
                    {Math.round(z * 100)}%
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${BRAND.cream}15`, margin: '2px 0' }} />
                <button
                  onClick={() => { props.onZoomReset(); setZoomMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    padding: '7px 12px', background: 'transparent',
                    border: 'none', color: BRAND.cream, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <Maximize2 size={11} /> Ajustar pantalla
                </button>
              </div>
            )}
          </div>
          <IconButton onClick={props.onZoomIn} title="Zoom in (Ctrl+=)"><ZoomIn size={14} /></IconButton>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconButton onClick={props.onPrev} disabled={props.currentIdx <= 0}><ChevronLeft size={14} /></IconButton>
        <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.6, minWidth: 320, textAlign: 'center' }}>
          {String(props.currentIdx + 1).padStart(2, '0')} / {String(props.total).padStart(2, '0')} — {props.subtitle}
        </span>
        <IconButton onClick={props.onNext} disabled={props.currentIdx >= props.total - 1}><ChevronRight size={14} /></IconButton>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={props.onDownloadCurrent}
          disabled={props.downloading || props.total === 0}
          style={{ padding: '8px 14px', background: BRAND.cream, border: 'none', borderRadius: 6, color: BRAND.ink, fontWeight: 700, fontSize: 11, letterSpacing: 0.8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={12} /> SLIDE
        </button>
        <button
          onClick={props.onDownloadAll}
          disabled={props.downloading || props.total === 0}
          style={{ padding: '8px 14px', background: BRAND.ink, border: `1px solid ${BRAND.blue}`, borderRadius: 6, color: BRAND.cream, fontWeight: 700, fontSize: 11, letterSpacing: 0.8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {props.downloading ? <Loader2 size={12} className="spin" /> : <Package size={12} />}
          TODAS
        </button>
      </div>
    </div>
  );
}

function IconButton({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'transparent', border: `1px solid ${BRAND.cream}30`, color: BRAND.cream,
        padding: 8, borderRadius: 4, cursor: 'pointer', display: 'flex',
      }}
    >
      {children}
    </button>
  );
}

function WarningsPanel() {
  const warnings = useUiStore((s) => s.warnings);
  const setWarnings = useUiStore((s) => s.setWarnings);
  if (warnings.length === 0) return null;
  return (
    <div style={{ marginTop: 16, padding: 12, background: '#14141E', border: `1px solid ${BRAND.blue}40`, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 11, letterSpacing: 1.5 }}>AUTO-FIX · {warnings.length}</strong>
        <button
          onClick={() => setWarnings([])}
          style={{ background: 'transparent', border: 'none', color: BRAND.cream, opacity: 0.5, fontSize: 11, cursor: 'pointer' }}
        >
          cerrar
        </button>
      </div>
      {warnings.slice(0, 6).map((w, i) => (
        <div key={i} style={{ fontSize: 11, opacity: 0.75, padding: '3px 0' }}>
          {iconForKind(w.kind)} {labelForKind(w.kind)}{w.detail ? ` · ${w.detail}` : ''}
        </div>
      ))}
    </div>
  );
}

function iconForKind(kind: string): string {
  if (kind === 'out-of-safe')   return '🔲';
  if (kind === 'overlap')       return '⚠️';
  if (kind === 'text-overflow') return '✂️';
  if (kind === 'low-contrast')  return '🌗';
  return '•';
}
function labelForKind(kind: string): string {
  if (kind === 'out-of-safe')   return 'bloque fuera de márgenes';
  if (kind === 'overlap')       return 'colisión entre bloques';
  if (kind === 'text-overflow') return 'texto reducido para entrar';
  if (kind === 'low-contrast')  return 'contraste bajo, color ajustado';
  return kind;
}
