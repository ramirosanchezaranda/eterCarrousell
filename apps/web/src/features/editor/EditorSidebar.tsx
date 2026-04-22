/**
 * Sidebar del editor reorganizado en 4 grupos accesibles (Figma/Canva style):
 *
 *   🎨 Diseño     — Plantillas · Formato · Fondo · Guías
 *   ✍️ Contenido — Generar · Contenido · Marca
 *   📦 Recursos   — Galería imágenes · Galería fuentes · Assets
 *   📋 Capas      — Capas del slide activo
 *
 * El PropertiesPanel aparece al final cuando hay un bloque seleccionado,
 * independientemente de la tab activa.
 */
import { useState } from 'react';
import {
  FileText, GripVertical, Grid3x3, Image as ImageIcon, Images, Layers, Lock,
  Palette, Square, Sliders, Sparkles, Type, TypeOutline, Box,
} from 'lucide-react';
import { useProjectStore } from '@/state/projectStore';
import { useUiStore } from '@/state/uiStore';
import { useAssetsStore } from '@/state/assetsStore';
import { FORMATS_LIST } from '@/formats';
import { CLASSIC_TEMPLATES_META, EDITORIAL_TEMPLATES_META } from '@/templates';
import { GUIDES_LIST } from '@/guides';
import { BRAND, FONT_PRESETS } from '@/domain';
import { ImageUploader } from '@/ui';
import { GenerateTab } from '@/features/generate/GenerateTab';
import { GalleryGrid } from './GalleryGrid';
import { BackgroundTab } from './BackgroundTab';
import { TemplateThumb } from './TemplateThumb';
import { FontGallery } from './FontGallery';

type Group = 'design' | 'content' | 'resources' | 'layers';

interface Tab {
  key: string;
  label: string;
  icon: typeof Square;
  group: Group;
}

const TABS: Tab[] = [
  { key: 'template',   label: 'Plantillas', icon: Square,       group: 'design' },
  { key: 'format',     label: 'Formato',    icon: Sliders,      group: 'design' },
  { key: 'background', label: 'Fondo',      icon: Palette,      group: 'design' },
  { key: 'guides',     label: 'Guías',      icon: Grid3x3,      group: 'design' },
  { key: 'generate',   label: 'Generar',    icon: Sparkles,     group: 'content' },
  { key: 'content',    label: 'Contenido',  icon: FileText,     group: 'content' },
  { key: 'brand',      label: 'Marca',      icon: Type,         group: 'content' },
  { key: 'gallery',    label: 'Imágenes',   icon: Images,       group: 'resources' },
  { key: 'fonts',      label: 'Fuentes',    icon: TypeOutline,  group: 'resources' },
  { key: 'assets',     label: 'Assets',     icon: ImageIcon,    group: 'resources' },
  { key: 'layers',     label: 'Capas',      icon: Layers,       group: 'layers' },
];

const GROUPS: Array<{ key: Group; label: string; icon: typeof Square }> = [
  { key: 'design',    label: 'Diseño',    icon: Palette },
  { key: 'content',   label: 'Contenido', icon: Box },
  { key: 'resources', label: 'Recursos',  icon: Images },
  { key: 'layers',    label: 'Capas',     icon: Layers },
];

export function EditorSidebar() {
  const ui = useUiStore();
  const assets = useAssetsStore();
  const activeTab = TABS.find((t) => t.key === ui.activeTab) ?? TABS[0]!;
  const [openGroup, setOpenGroup] = useState<Group>(activeTab.group);

  const tabsInGroup = TABS.filter((t) => t.group === openGroup);

  return (
    <aside style={{ position: 'sticky', top: 24, alignSelf: 'start', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', paddingRight: 2 }}>
      <h1 style={{ fontFamily: assets.theme.fonts.display, fontSize: 26, fontStyle: 'italic', margin: 0, color: BRAND.cream, lineHeight: 1.1 }}>
        eterCore <span style={{ color: BRAND.blue }}>/ studio</span>
      </h1>

      {/* Grupos principales (nivel 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 16, padding: 3, background: '#14141E', borderRadius: 8 }}>
        {GROUPS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setOpenGroup(key);
              const firstInGroup = TABS.find((t) => t.group === key);
              if (firstInGroup) ui.setActiveTab(firstInGroup.key as typeof ui.activeTab);
            }}
            title={label}
            aria-label={label}
            aria-pressed={openGroup === key}
            style={{
              padding: '10px 6px', background: openGroup === key ? BRAND.blue : 'transparent',
              border: 'none', borderRadius: 5, color: BRAND.cream, fontSize: 10, fontWeight: 700,
              letterSpacing: 0.5, cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3,
            }}
          >
            <Icon size={14} />
            <span style={{ fontSize: 9, opacity: openGroup === key ? 1 : 0.7 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Sub-tabs dentro del grupo (nivel 2) */}
      {tabsInGroup.length > 1 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 10, flexWrap: 'wrap' }}>
          {tabsInGroup.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => ui.setActiveTab(key as typeof ui.activeTab)}
              aria-pressed={ui.activeTab === key}
              style={{
                flex: 1, padding: '6px 8px',
                background: ui.activeTab === key ? BRAND.blue + '30' : 'transparent',
                border: `1px solid ${ui.activeTab === key ? BRAND.blue : BRAND.cream + '15'}`,
                borderRadius: 4, color: BRAND.cream, fontSize: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 0,
              }}
            >
              <Icon size={11} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Contenido del tab activo */}
      <div style={{ marginTop: 18 }}>
        {ui.activeTab === 'template'   && <TemplatesTab />}
        {ui.activeTab === 'generate'   && <GenerateTab />}
        {ui.activeTab === 'gallery'    && <GalleryGrid />}
        {ui.activeTab === 'fonts'      && <FontGallery />}
        {ui.activeTab === 'background' && <BackgroundTab />}
        {ui.activeTab === 'format'     && <FormatTabContent />}
        {ui.activeTab === 'guides'     && <GuidesTabContent />}
        {ui.activeTab === 'content'    && <ContentTabContent />}
        {ui.activeTab === 'brand'      && <BrandTabContent />}
        {ui.activeTab === 'assets'     && <AssetsTabContent />}
        {ui.activeTab === 'layers'     && <LayersTabContent />}
      </div>

    </aside>
  );
}

// ===================================================================
// Sub-tabs
// ===================================================================

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 10, marginTop: 14 }}>
      {children}
    </div>
  );
}

function TemplatesTab() {
  const project = useProjectStore();
  const assets = useAssetsStore();
  const templateAssets = {
    logoSrc: assets.logoDataURI,
    decorASrc: assets.decorADataURI,
    decorBSrc: assets.decorBDataURI,
  };
  const [family, setFamily] = useState<'all' | 'classic' | 'editorial'>('all');
  const list =
    family === 'classic' ? CLASSIC_TEMPLATES_META :
    family === 'editorial' ? EDITORIAL_TEMPLATES_META :
    [...CLASSIC_TEMPLATES_META, ...EDITORIAL_TEMPLATES_META];
  const activeTemplate = project.slides[0]?.templateId;

  return (
    <>
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {(['all', 'classic', 'editorial'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFamily(f)}
            style={{
              flex: 1, padding: '6px', background: family === f ? BRAND.blue + '30' : '#14141E',
              border: `1px solid ${family === f ? BRAND.blue : BRAND.cream + '15'}`,
              borderRadius: 4, color: BRAND.cream, fontSize: 10, cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {f === 'all' ? `Todas · ${CLASSIC_TEMPLATES_META.length + EDITORIAL_TEMPLATES_META.length}` : `${f} · ${f === 'classic' ? CLASSIC_TEMPLATES_META.length : EDITORIAL_TEMPLATES_META.length}`}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 10, opacity: 0.55, lineHeight: 1.5, marginBottom: 10 }}>
        Click en una plantilla para inicializar las 6 slides.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {list.map((t) => (
          <TemplateThumb
            key={t.id}
            template={t}
            theme={assets.theme}
            active={activeTemplate === t.id}
            onClick={() => project.initFromTemplate(t.id, assets.theme, templateAssets)}
          />
        ))}
      </div>
    </>
  );
}

function FormatTabContent() {
  const project = useProjectStore();
  return (
    <>
      <SectionTitle>Formato del carrusel</SectionTitle>
      {FORMATS_LIST.map((f) => (
        <button
          key={f.id}
          onClick={() => project.setFormatId(f.id)}
          style={{
            width: '100%', marginBottom: 6, padding: 12, textAlign: 'left', fontSize: 12,
            background: project.formatId === f.id ? `${BRAND.blue}30` : '#14141E',
            border: `1px solid ${project.formatId === f.id ? BRAND.blue : BRAND.cream + '15'}`,
            borderRadius: 6, color: BRAND.cream, cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 700 }}>{f.label}</div>
          <div style={{ opacity: 0.55, fontSize: 10, marginTop: 3 }}>{f.width} × {f.height}</div>
        </button>
      ))}
    </>
  );
}

function GuidesTabContent() {
  const ui = useUiStore();
  return (
    <>
      <SectionTitle>Asistencia visual</SectionTitle>
      <label style={toggleLabel}>
        <input type="checkbox" checked={ui.snapEnabled} onChange={(e) => ui.setSnapEnabled(e.target.checked)} />
        <span style={{ fontSize: 12 }}>Snap magnético ({ui.snapThresholdPx}px)</span>
      </label>
      <label style={toggleLabel}>
        <input type="checkbox" checked={ui.autoFixEnabled} onChange={(e) => ui.setAutoFixEnabled(e.target.checked)} />
        <span style={{ fontSize: 12 }}>Auto-fix al soltar drag</span>
      </label>
      <p style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.5, marginBottom: 14 }}>
        {ui.autoFixEnabled ? 'Motor corrige overlaps, márgenes y contraste al soltar.' : 'Libertad total: colocá bloques donde quieras. Warnings como aviso.'}
      </p>
      <SectionTitle>Visibilidad de guías</SectionTitle>
      <div style={{ marginBottom: 10, padding: 8, background: '#0A0A14', border: `1px solid ${BRAND.cream}15`, borderRadius: 4 }}>
        <GuideGlobalSlider
          label="Opacidad default"
          value={ui.defaultGuideOpacity}
          min={0.1} max={1} step={0.05}
          onChange={ui.setDefaultGuideOpacity}
        />
        <GuideGlobalSlider
          label="Grosor línea"
          value={ui.guideStrokeMultiplier}
          min={0.5} max={3} step={0.1}
          onChange={ui.setGuideStrokeMultiplier}
        />
      </div>
      <SectionTitle>Guías superpuestas</SectionTitle>
      {GUIDES_LIST.map((g) => {
        const active = ui.activeGuides.includes(g.id);
        const perGuideOp = ui.guideOpacity[g.id] ?? ui.defaultGuideOpacity;
        return (
          <div key={g.id} style={{ marginBottom: 4 }}>
            <button
              onClick={() => ui.toggleGuide(g.id)}
              style={{
                width: '100%', padding: '7px 10px', textAlign: 'left', fontSize: 11,
                background: active ? `${BRAND.blue}30` : '#14141E',
                border: `1px solid ${active ? BRAND.blue : BRAND.cream + '15'}`,
                borderRadius: active ? '6px 6px 0 0' : 6,
                color: BRAND.cream, cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600 }}>{g.label}</div>
              {g.description && <div style={{ opacity: 0.5, fontSize: 9.5, marginTop: 2 }}>{g.description}</div>}
            </button>
            {active && (
              <div style={{
                padding: '6px 10px 8px',
                background: '#0A0A14',
                border: `1px solid ${BRAND.blue}`,
                borderTop: 'none',
                borderRadius: '0 0 6px 6px',
              }}>
                <GuideGlobalSlider
                  label="Transparencia"
                  value={perGuideOp}
                  min={0.05} max={1} step={0.05}
                  onChange={(v) => ui.setGuideOpacity(g.id, v)}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function GuideGlobalSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 9.5, opacity: 0.55, width: 78, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ fontSize: 10, fontFamily: 'monospace', width: 36, textAlign: 'right', opacity: 0.8 }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function ContentTabContent() {
  const project = useProjectStore();
  return (
    <>
      <SectionTitle>Tema</SectionTitle>
      <textarea
        value={project.topic}
        onChange={(e) => project.setTopic(e.target.value)}
        rows={3}
        style={{ width: '100%', padding: 12, background: '#14141E', border: `1px solid ${BRAND.blue}40`, borderRadius: 6, color: BRAND.cream, fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }}
      />
      <SectionTitle>Slides</SectionTitle>
      {project.slides.length === 0 ? (
        <p style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.5 }}>
          Elegí una plantilla en Diseño → Plantillas para arrancar.
        </p>
      ) : project.slides.map((s, i) => (
        <button
          key={s.id}
          onClick={() => project.setCurrentSlideId(s.id)}
          style={{
            width: '100%', textAlign: 'left', marginBottom: 4, padding: '8px 10px',
            background: s.id === project.currentSlideId ? `${BRAND.blue}30` : 'transparent',
            border: `1px solid ${s.id === project.currentSlideId ? BRAND.blue : BRAND.cream + '15'}`,
            borderRadius: 4, color: BRAND.cream, fontSize: 11, cursor: 'pointer',
            display: 'flex', gap: 8, alignItems: 'center',
          }}
        >
          <span style={{ fontFamily: 'monospace', opacity: 0.5, fontSize: 10 }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, opacity: 0.6, textTransform: 'uppercase', minWidth: 60 }}>{s.type}</span>
        </button>
      ))}
    </>
  );
}

function BrandTabContent() {
  const assets = useAssetsStore();
  return (
    <>
      <SectionTitle>Preset tipográfico</SectionTitle>
      {Object.entries(FONT_PRESETS).map(([key, preset]) => (
        <button
          key={key}
          onClick={() => assets.setFontKey(key)}
          style={{
            width: '100%', marginBottom: 6, padding: 12,
            background: assets.fontKey === key ? `${BRAND.blue}30` : '#14141E',
            border: `1px solid ${assets.fontKey === key ? BRAND.blue : BRAND.cream + '15'}`,
            borderRadius: 6, color: BRAND.cream, cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ fontFamily: preset.display, fontSize: 22, fontStyle: 'italic', color: BRAND.blue, marginBottom: 2 }}>Aa</div>
          <div style={{ fontSize: 11, opacity: 0.7, fontFamily: preset.sans }}>{preset.label}</div>
        </button>
      ))}
      <p style={{ fontSize: 10, opacity: 0.5, marginTop: 12 }}>
        Para subir fuentes propias → tab Recursos / Fuentes.
      </p>
    </>
  );
}

function AssetsTabContent() {
  const assets = useAssetsStore();
  return (
    <>
      <SectionTitle>Logo</SectionTitle>
      <ImageUploader value={assets.logoDataURI} onChange={(v) => void assets.setLogo(v)} label="Logo" height={100} />
      <SectionTitle>Imágenes decorativas del carrusel</SectionTitle>
      <ImageUploader value={assets.decorADataURI} onChange={(v) => void assets.setDecorA(v)} label="Decor A (slides pares)" height={120} />
      <ImageUploader value={assets.decorBDataURI} onChange={(v) => void assets.setDecorB(v)} label="Decor B (slides impares)" height={120} />
    </>
  );
}

function LayersTabContent() {
  const project = useProjectStore();
  const ui = useUiStore();
  const activeSlide = project.slides.find((s) => s.id === project.currentSlideId);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (!activeSlide) {
    return (
      <>
        <SectionTitle>Capas del slide activo</SectionTitle>
        <p style={{ fontSize: 11, opacity: 0.55 }}>Sin slide activo</p>
      </>
    );
  }

  // Orden visual: más adelante arriba (mayor zIndex primero).
  const visibleOrder = activeSlide.blocks.slice().sort((a, b) => b.zIndex - a.zIndex);

  const onDragStart = (blockId: string) => (e: React.DragEvent) => {
    setDragId(blockId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId);
  };

  const onDragOver = (blockId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (blockId !== dragId) setDragOverId(blockId);
  };

  const onDragLeave = () => setDragOverId(null);

  const onDrop = (targetBlockId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = dragId ?? e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetBlockId) { setDragId(null); setDragOverId(null); return; }
    const currentOrderIds = visibleOrder.map((b) => b.id);
    const srcIdx = currentOrderIds.indexOf(sourceId);
    const tgtIdx = currentOrderIds.indexOf(targetBlockId);
    if (srcIdx === -1 || tgtIdx === -1) { setDragId(null); setDragOverId(null); return; }
    const next = [...currentOrderIds];
    const [moved] = next.splice(srcIdx, 1);
    if (moved) next.splice(tgtIdx, 0, moved);
    // El panel muestra arriba = más adelante (mayor z). Invertimos para pasar al store
    // donde el primero del array es el más atrás.
    project.reorderBlocks(activeSlide.id, next.slice().reverse());
    setDragId(null);
    setDragOverId(null);
  };

  return (
    <>
      <SectionTitle>Capas del slide activo</SectionTitle>
      <p style={{ fontSize: 10, opacity: 0.5, marginBottom: 8, lineHeight: 1.5 }}>
        Arrastrá el handle <GripVertical size={10} style={{ verticalAlign: 'middle' }} /> para reordenar.
        Arriba = al frente.
      </p>
      {visibleOrder.map((b) => {
        const isSel = ui.selectedBlockIds.includes(b.id);
        const isDrag = dragId === b.id;
        const isOver = dragOverId === b.id;
        return (
          <div
            key={b.id}
            draggable
            onDragStart={onDragStart(b.id)}
            onDragOver={onDragOver(b.id)}
            onDragLeave={onDragLeave}
            onDrop={onDrop(b.id)}
            onClick={() => ui.selectBlock(b.id)}
            style={{
              marginBottom: 3, padding: '6px 10px', fontSize: 11,
              background: isOver ? BRAND.blue + '50' : isSel ? BRAND.blue + '30' : '#14141E',
              border: `1px solid ${isOver ? BRAND.blue : isSel ? BRAND.blue : BRAND.cream + '10'}`,
              borderRadius: 4, color: BRAND.cream, cursor: 'grab',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              opacity: isDrag ? 0.4 : 1,
              transition: 'background 120ms ease',
              userSelect: 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GripVertical size={11} style={{ opacity: 0.5 }} />
              <span>{b.kind}</span>
              {b.locked && <Lock size={9} style={{ opacity: 0.6 }} />}
              <span style={{ opacity: 0.4, fontSize: 9, fontFamily: 'monospace' }}>z{b.zIndex}</span>
            </span>
            <span style={{ opacity: 0.4, fontSize: 9 }}>{Math.round(b.rect.x)},{Math.round(b.rect.y)}</span>
          </div>
        );
      })}
    </>
  );
}

const toggleLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: '#14141E', borderRadius: 6,
  marginBottom: 6, cursor: 'pointer',
};
