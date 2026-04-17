/**
 * Renderiza un PositionedBlock como SVG. Delega por `content.kind` a los
 * primitivos existentes (GlitchTexture, DecorSlot, Star, etc.).
 *
 * MEMOIZADO: `React.memo` con comparador que solo revisa los campos que
 * afectan el render. Mover un bloque A no fuerza re-render del bloque B
 * si sus props no cambiaron. Cuello clave de performance en drag/resize.
 */
import { memo } from 'react';
import type { BrandTheme, PositionedBlock, ResolvedFonts } from '@/domain';
import { DecorSlot, GlitchTexture, Star } from './primitives';
import { buildFilterChain } from './effects';

interface BlockViewProps {
  block: PositionedBlock;
  theme: BrandTheme;
  fonts: ResolvedFonts;
  seed: number;
}

function BlockViewImpl({ block, theme, fonts, seed }: BlockViewProps) {
  const { rect, rotation } = block;
  const transform = rotation ? `rotate(${rotation} ${rect.x + rect.w / 2} ${rect.y + rect.h / 2})` : undefined;
  const common = { transform };
  // Efectos aplicables a cualquier tipo de bloque (texto incluido).
  const effects = block.content.effects;
  const chain = buildFilterChain(block.id, effects);
  const filterUrl = chain ? `url(#${chain.id})` : undefined;
  switch (block.content.kind) {
    case 'text':
      return (
        <g {...common}>
          {chain && <defs>{chain.node}</defs>}
          <g filter={filterUrl}>{renderText(block, theme, fonts)}</g>
        </g>
      );
    case 'image':
      return (
        <g {...common}>
          {chain && <defs>{chain.node}</defs>}
          <image
            href={block.content.src}
            x={rect.x} y={rect.y} width={rect.w} height={rect.h}
            preserveAspectRatio={fitToAspect(block.content.fit)}
            filter={filterUrl}
          />
        </g>
      );
    case 'shape':
      return (
        <g {...common}>
          {chain && <defs>{chain.node}</defs>}
          <g filter={filterUrl}>{renderShape(block)}</g>
        </g>
      );
    case 'decor':
      return (
        <g {...common}>
          {chain && <defs>{chain.node}</defs>}
          <g filter={filterUrl}>{renderDecor(block, seed)}</g>
        </g>
      );
    case 'path':
      return (
        <g {...common}>
          {chain && <defs>{chain.node}</defs>}
          <path
            d={block.content.d}
            fill={block.content.fill ?? '#000000'}
            stroke={block.content.stroke}
            strokeWidth={block.content.strokeWidth}
            opacity={block.content.opacity}
            filter={filterUrl}
          />
        </g>
      );
  }
}

function renderText(block: PositionedBlock, _theme: BrandTheme, fonts: ResolvedFonts): JSX.Element {
  if (block.content.kind !== 'text') return <g />;
  const c = block.content;
  const fontFamily = c.fontFamilyOverride ??
    (c.fontRole === 'sans' ? fonts.sans :
     c.fontRole === 'script' ? fonts.script :
     c.fontRole === 'mono' ? fonts.mono :
     fonts.display);
  const useRuns = c.runs && c.runs.length > 0;
  const flatText = useRuns
    ? (c.runs ?? []).map((r) => r.text).join('')
    : c.text;
  const displayText = c.upper ? flatText.toUpperCase() : flatText;
  const lineH = c.fontSize * (c.lineHeight ?? 1.15);
  const lines = useRuns
    // Por ahora no partimos runs por líneas (no soporta \n dentro de un run).
    ? [displayText]
    : displayText.split('\n');
  const anchorX =
    c.textAlign === 'middle' ? block.rect.x + block.rect.w / 2 :
    c.textAlign === 'end' ? block.rect.x + block.rect.w :
    block.rect.x;

  // Gradient fill (opcional) como <linearGradient> al que apunta `fill`
  const gradId = c.gradientFill ? `txt-grad-${block.id}` : null;
  const gradient = c.gradientFill ? (() => {
    const g = c.gradientFill;
    const rad = (g.angle - 90) * (Math.PI / 180);
    const x1 = 0.5 - Math.cos(rad) * 0.5;
    const y1 = 0.5 - Math.sin(rad) * 0.5;
    const x2 = 0.5 + Math.cos(rad) * 0.5;
    const y2 = 0.5 + Math.sin(rad) * 0.5;
    return (
      <linearGradient id={gradId!} x1={x1} y1={y1} x2={x2} y2={y2}>
        {g.stops.map((s, i) => <stop key={i} offset={s.at} stopColor={s.color} />)}
      </linearGradient>
    );
  })() : null;

  const fillValue = gradId ? `url(#${gradId})` : c.color;

  // text-decoration (underline + strike pueden combinarse)
  const decor: string[] = [];
  if (c.underline) decor.push('underline');
  if (c.strike) decor.push('line-through');
  const textDecoration = decor.length ? decor.join(' ') : undefined;

  const hasStroke = c.stroke && c.stroke.width > 0;

  // Wrapper común para atributos del <text>
  const textAttrs = {
    textAnchor: c.textAlign,
    fontFamily,
    fontSize: c.fontSize,
    fontStyle: c.fontStyle ?? 'normal',
    fontWeight: c.fontWeight ?? 400,
    letterSpacing: c.letterSpacing ?? 0,
    fill: fillValue,
    stroke: hasStroke ? c.stroke!.color : undefined,
    strokeWidth: hasStroke ? c.stroke!.width : undefined,
    strokeDasharray: hasStroke ? c.stroke!.dasharray : undefined,
    paintOrder: hasStroke ? 'stroke fill' : undefined,
    textDecoration,
  };

  // Render con runs → un solo <text> con <tspan>s por run
  if (useRuns && c.runs) {
    const yLine = block.rect.y + lineH * 0.85;
    return (
      <>
        {gradient && <defs>{gradient}</defs>}
        <text key="rich" x={anchorX} y={yLine} {...textAttrs}>
          {c.runs.map((run, i) => {
            const runText = c.upper ? run.text.toUpperCase() : run.text;
            const runDecor: string[] = [];
            if (run.underline) runDecor.push('underline');
            if (run.strike) runDecor.push('line-through');
            return (
              <tspan
                key={i}
                fontWeight={run.bold ? 700 : undefined}
                fontStyle={run.italic ? 'italic' : undefined}
                textDecoration={runDecor.length ? runDecor.join(' ') : undefined}
                fill={run.color ?? undefined}
              >
                {runText}
              </tspan>
            );
          })}
        </text>
      </>
    );
  }

  return (
    <>
      {gradient && <defs>{gradient}</defs>}
      {lines.map((ln, i) => (
        <text
          key={i}
          x={anchorX}
          y={block.rect.y + lineH * (i + 0.85)}
          {...textAttrs}
        >
          {ln}
        </text>
      ))}
    </>
  );
}

function renderShape(block: PositionedBlock): JSX.Element {
  if (block.content.kind !== 'shape') return <g />;
  const { shape, fill, stroke, strokeWidth, opacity } = block.content;
  const { x, y, w, h } = block.rect;
  const common = { fill: fill ?? 'transparent', stroke, strokeWidth, opacity };
  switch (shape) {
    case 'rect':     return <rect x={x} y={y} width={w} height={h} {...common} />;
    case 'circle':   return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />;
    case 'line':     return <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={stroke ?? fill ?? '#000'} strokeWidth={strokeWidth ?? 2} opacity={opacity} />;
    case 'star':     return <g><Star cx={x + w / 2} cy={y + h / 2} size={Math.min(w, h) / 2} color={fill ?? '#000'} /></g>;
    case 'triangle': return <polygon points={`${x + w / 2},${y} ${x},${y + h} ${x + w},${y + h}`} {...common} />;
  }
}

function renderDecor(block: PositionedBlock, slideSeed: number): JSX.Element {
  if (block.content.kind !== 'decor') return <g />;
  const c = block.content;
  const { x, y, w, h } = block.rect;
  const seed = c.seed ?? slideSeed;
  if (c.mode === 'image' && c.src) {
    return (
      <>
        <DecorSlot src={c.src} seed={seed} x={x} y={y} width={w} height={h} density={c.density ?? 1} />
        {c.overlay && <rect x={x} y={y} width={w} height={h} fill={c.overlay.color} opacity={c.overlay.opacity} />}
      </>
    );
  }
  return (
    <>
      <GlitchTexture seed={seed} x={x} y={y} width={w} height={h} density={c.density ?? 0.5} />
      {c.overlay && <rect x={x} y={y} width={w} height={h} fill={c.overlay.color} opacity={c.overlay.opacity} />}
    </>
  );
}

function fitToAspect(fit: 'cover' | 'contain' | 'fill'): string {
  if (fit === 'cover') return 'xMidYMid slice';
  if (fit === 'contain') return 'xMidYMid meet';
  return 'none';
}

/**
 * Comparador custom para React.memo. Solo rerenderiza si el bloque, tema o
 * fonts realmente cambiaron por referencia — NO cuando otro bloque se moveu.
 * Los stores Zustand garantizan nuevas refs solo para los bloques modificados.
 */
export const BlockView = memo(BlockViewImpl, (prev, next) => (
  prev.block === next.block &&
  prev.theme === next.theme &&
  prev.fonts === next.fonts &&
  prev.seed === next.seed
));
