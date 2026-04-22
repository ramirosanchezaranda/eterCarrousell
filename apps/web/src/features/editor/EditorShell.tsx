/**
 * Shell del editor: monta Sidebar + EditorCanvas + topbar (undo/redo + export).
 * Es el componente root del nuevo editor (reemplaza al LegacyCarouselApp en App.tsx).
 */
import { useEffect, useRef, useState } from 'react';
import { Download, Keyboard, Package, Redo2, Undo2, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, SlidersHorizontal, X, LayoutGrid } from 'lucide-react';
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
import { useLayout } from './useViewport';
import { CanvasStatusBar } from './CanvasStatusBar';
import { GridView } from './GridView';

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

  // Atajos de teclado. Pasa handlers de export para Ctrl+S / Ctrl+Shift+S.
  // Se declara al final para que los handlers arriba ya estén inicializados.
  useKeyboardShortcuts({
    downloadCurrent: () => void handleDownloadCurrent(),
    downloadAll: () => void handleDownloadAll(),
  });

  // Layout responsive: detecta viewport y calcula qué mostrar.
  const layout = useLayout();
  const isMobile = layout === 'mobile';
  // En modo fullscreen forzamos ambos paneles a colapsar para que el
  // canvas ocupe toda la pantalla (sin importar el toggle manual).
  const fullscreen = ui.canvasFullscreen;
  const leftCollapsed  = fullscreen || ui.leftSidebarCollapsed  || isMobile;
  const rightCollapsed = fullscreen || ui.rightSidebarCollapsed || isMobile;
  const leftColumn  = leftCollapsed  ? '0' : '340px';
  const rightColumn = rightCollapsed ? '0' : '340px';
  const gridTemplateColumns = isMobile || fullscreen ? '1fr' : `${leftColumn} 1fr ${rightColumn}`;

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      background: '#0A0A14',
      color: BRAND.cream,
      fontFamily: assets.theme.fonts.sans,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${assets.theme.fonts.googleFamilies.split('|').join('&family=')}&display=swap`} />
      <div style={{
        display: 'grid',
        gridTemplateColumns,
        gap: isMobile ? 0 : 16,
        padding: isMobile ? 0 : 16,
        paddingBottom: isMobile ? 72 : 16, // deja espacio a la mobile bottom bar
        maxWidth: 2400,
        margin: '0 auto',
        width: '100%',
        // alignItems: stretch + flex 1 hacen que cada columna ocupe toda la
        // altura disponible — el canvas adentro puede crecer a 100% de alto.
        alignItems: 'stretch',
        flex: 1,
        minHeight: 0,
        transition: 'grid-template-columns 180ms ease',
      }}>
        {!leftCollapsed && <EditorSidebar />}
        <main style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          padding: isMobile ? 8 : 0,
        }}>
          {!ui.canvasFullscreen && (
            <TopBar
              total={slides.length}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onDownloadCurrent={handleDownloadCurrent}
              onDownloadAll={handleDownloadAll}
              onShowHelp={() => ui.setShowShortcutsHelp(true)}
              downloading={ui.downloading}
              leftCollapsed={ui.leftSidebarCollapsed}
              rightCollapsed={ui.rightSidebarCollapsed}
              onToggleLeft={ui.toggleLeftSidebar}
              onToggleRight={ui.toggleRightSidebar}
              showSidebarToggles={!isMobile}
            />
          )}
          {/**
           * Área del canvas: flex:1 ocupa toda la altura sobrante entre
           * la TopBar y el pie de la pantalla. El EditorCanvas adentro
           * tiene aspect-ratio fijo + max-width/max-height 100% → el
           * canvas crece hasta lo que permita la dimensión más chica,
           * manteniendo proporción del slide.
           */}
          <div
            ref={canvasWrapRef}
            style={{
              flex: 1,
              minHeight: 0,
              // Padding amplio alrededor del canvas para que respire en
              // pantallas grandes. En mobile el padding sigue pero el canvas
              // llena el resto por aspect-ratio.
              padding: isMobile ? '8px 4px 4px' : '20px 16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <EditorCanvas />
          </div>
          <CanvasStatusBar
            subtitle={currentSlide ? `${currentSlide.type} — ${currentSlide.templateId} — ${format.label}` : format.label}
          />
          {ui.warnings.length > 0 && <WarningsPanel />}
          <ShortcutsHelp />
          {ui.showAutoFixToast && (
            <div style={{ position: 'fixed', bottom: 24, right: 24, background: BRAND.blue, color: BRAND.cream, padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              Diseño auto-ajustado
            </div>
          )}
        </main>
        {!rightCollapsed && <PropertiesColumn />}
      </div>
      {/**
       * Mobile bottom bar — 2 botones grandes (izquierda/derecha) que abren
       * cada panel como bottom-sheet. Fijo al borde inferior; el padding-bottom
       * del grid padre reserva espacio para que no tape el canvas.
       */}
      {isMobile && (
        <MobileBottomBar
          activeSheet={ui.mobileSheet}
          onOpenLeft={() => ui.setMobileSheet(ui.mobileSheet === 'left' ? null : 'left')}
          onOpenRight={() => ui.setMobileSheet(ui.mobileSheet === 'right' ? null : 'right')}
        />
      )}
      {isMobile && ui.mobileSheet === 'left' && (
        <MobileSheet title="Diseño y contenido" onClose={() => ui.setMobileSheet(null)} showCanvas>
          <EditorSidebar />
        </MobileSheet>
      )}
      {isMobile && ui.mobileSheet === 'right' && (
        <MobileSheet title="Propiedades" onClose={() => ui.setMobileSheet(null)} showCanvas>
          <PropertiesColumn />
        </MobileSheet>
      )}
      {/* Vista grid de todas las slides (modal fullscreen) */}
      <GridView />
      <style>{`
        button:disabled { opacity: 0.5; cursor: not-allowed !important; }
        aside::-webkit-scrollbar { width: 6px; }
        aside::-webkit-scrollbar-thumb { background: ${BRAND.blue}40; border-radius: 3px; }
      `}</style>
    </div>
  );
}

function MobileBottomBar({
  activeSheet, onOpenLeft, onOpenRight,
}: {
  activeSheet: 'left' | 'right' | null;
  onOpenLeft: () => void;
  onOpenRight: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0,
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      height: 60,
      background: '#0A0A14',
      borderTop: `1px solid ${BRAND.blue}40`,
      zIndex: 40,
    }}>
      <BottomBarBtn
        icon={<LayoutGrid size={18} />}
        label="Diseño"
        active={activeSheet === 'left'}
        onClick={onOpenLeft}
      />
      <BottomBarBtn
        icon={<SlidersHorizontal size={18} />}
        label="Propiedades"
        active={activeSheet === 'right'}
        onClick={onOpenRight}
      />
    </div>
  );
}

function BottomBarBtn({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3,
        background: active ? `${BRAND.blue}30` : 'transparent',
        border: 'none',
        color: active ? BRAND.cream : `${BRAND.cream}B0`,
        fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * Bottom-sheet mobile con live-preview del canvas.
 *
 *   · ≥ 640px (mobile landscape / tablet portrait): split HORIZONTAL
 *     — controles a la izquierda (~320-360px) + canvas a la derecha.
 *   · < 640px (mobile portrait chico):             split VERTICAL
 *     — canvas arriba (máx 40vh) + controles abajo con scroll.
 *
 * En ambos casos el canvas es el mismo `<EditorCanvas />` que comparte
 * store, así que cualquier cambio en los controles se ve al instante.
 */
function MobileSheet({
  title, onClose, showCanvas, children,
}: { title: string; onClose: () => void; showCanvas?: boolean; children: React.ReactNode }) {
  const [winWidth, setWinWidth] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 0));
  useEffect(() => {
    const onResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const hasCanvas = !!showCanvas;
  const horizontalSplit = hasCanvas && winWidth >= 640;
  const verticalSplit   = hasCanvas && winWidth < 640;

  return (
    <div
      role="dialog"
      aria-label={title}
      onPointerDown={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 100,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: '#0A0A14',
          borderTop: `1px solid ${BRAND.blue}80`,
          borderRadius: '16px 16px 0 0',
          // Split necesita más altura para alojar canvas + controles.
          // En vertical el canvas ya ocupa ~40vh, así que elevamos a 96vh.
          maxHeight: horizontalSplit ? '92vh' : verticalSplit ? '96vh' : '85vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 64, // sobre la bottom bar
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${BRAND.cream}15`,
        }}>
          <strong style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.75 }}>
            {title}
          </strong>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: BRAND.cream, cursor: 'pointer',
              padding: 4, display: 'flex',
            }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {horizontalSplit && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 360px) 1fr',
            gap: 12,
            flex: 1,
            minHeight: 0, // crítico para que los hijos con overflow auto respeten la altura del grid
            padding: 12,
          }}>
            <div style={{ overflow: 'auto', minHeight: 0 }}>
              {children}
            </div>
            <div style={{
              overflow: 'auto',
              minHeight: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: 4,
            }}>
              <EditorCanvas />
            </div>
          </div>
        )}

        {verticalSplit && (
          <div style={{
            display: 'grid',
            // Canvas arriba ocupando el 55% del alto, controles abajo con
            // scroll. El canvas es el protagonista — los sliders/inputs
            // del panel siguen siendo táctiles abajo.
            gridTemplateRows: '55% 1fr',
            gap: 6,
            flex: 1,
            minHeight: 0,
            padding: 8,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 0,
              borderBottom: `1px solid ${BRAND.blue}30`,
              paddingBottom: 6,
            }}>
              <EditorCanvas />
            </div>
            <div style={{ overflow: 'auto', minHeight: 0 }}>
              {children}
            </div>
          </div>
        )}

        {!hasCanvas && (
          <div style={{ overflow: 'auto', padding: 12, flex: 1 }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function TopBar(props: {
  onUndo: () => void;
  onRedo: () => void;
  onDownloadCurrent: () => void;
  onDownloadAll: () => void;
  onShowHelp: () => void;
  downloading: boolean;
  total: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  showSidebarToggles: boolean;
}) {
  /**
   * TopBar simplificada: solo undo/redo/help + toggles de sidebars + export.
   * La navegación de slides y los controles de zoom viven ahora en la
   * `CanvasStatusBar` (pie del canvas, estilo Canva).
   */
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', padding: '6px 8px', flexWrap: 'wrap', borderBottom: `1px solid ${BRAND.cream}10` }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {props.showSidebarToggles && (
          <IconButton
            onClick={props.onToggleLeft}
            title={props.leftCollapsed ? 'Mostrar panel izquierdo' : 'Ocultar panel izquierdo'}
          >
            {props.leftCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </IconButton>
        )}
        <IconButton onClick={props.onUndo} title="Deshacer (Ctrl+Z)"><Undo2 size={14} /></IconButton>
        <IconButton onClick={props.onRedo} title="Rehacer (Ctrl+Y)"><Redo2 size={14} /></IconButton>
        <IconButton onClick={props.onShowHelp} title="Atajos de teclado (?)"><Keyboard size={14} /></IconButton>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={props.onDownloadCurrent}
          disabled={props.downloading || props.total === 0}
          style={{ padding: '7px 12px', background: BRAND.cream, border: 'none', borderRadius: 6, color: BRAND.ink, fontWeight: 700, fontSize: 11, letterSpacing: 0.8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={12} /> SLIDE
        </button>
        <button
          onClick={props.onDownloadAll}
          disabled={props.downloading || props.total === 0}
          style={{ padding: '7px 12px', background: BRAND.ink, border: `1px solid ${BRAND.blue}`, borderRadius: 6, color: BRAND.cream, fontWeight: 700, fontSize: 11, letterSpacing: 0.8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {props.downloading ? <Loader2 size={12} className="spin" /> : <Package size={12} />}
          TODAS
        </button>
        {props.showSidebarToggles && (
          <IconButton
            onClick={props.onToggleRight}
            title={props.rightCollapsed ? 'Mostrar panel derecho' : 'Ocultar panel derecho'}
          >
            {props.rightCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
          </IconButton>
        )}
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
