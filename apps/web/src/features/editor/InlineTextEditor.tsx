/**
 * Editor inline de texto con formato RICO — tipo Canva/Figma.
 *
 * Cambios respecto a la versión textarea:
 * - Usa `contentEditable` para permitir selección parcial con mouse/teclado.
 * - Toolbar flotante arriba del bloque con B / I / U / S que actúan solo
 *   sobre la porción seleccionada (usa `document.execCommand`).
 * - Al salir (blur / Esc), parsea el innerHTML del editor a `TextRun[]` y
 *   actualiza el store. Si no hay formato por run (todo uniforme), escribe
 *   `text` plano + flags a nivel bloque para mantener backward compat.
 *
 * execCommand sigue siendo la forma más universal y simple de hacer bold
 * en una Selection. Aunque está "deprecated", todos los browsers modernos
 * la soportan y no hay una API Selection + Range que la reemplace bien.
 */
import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Strikethrough, Underline } from 'lucide-react';
import type { PositionedBlock, ResolvedFonts, SlideFormat, TextRun } from '@/domain';
import { BRAND } from '@/domain';
import { useProjectStore } from '@/state/projectStore';

interface Props {
  block: PositionedBlock;
  slideId: string;
  format: SlideFormat;
  canvasWidthPx: number;
  fonts: ResolvedFonts;
  onDone: () => void;
}

export function InlineTextEditor({ block, slideId, format, canvasWidthPx, fonts, onDone }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const update = useProjectStore((s) => s.updateBlock);
  // Track de qué flags están activos en la selección actual — actualiza la toolbar.
  const [selState, setSelState] = useState({ bold: false, italic: false, underline: false, strike: false });

  useEffect(() => {
    if (!ref.current) return;
    ref.current.focus();
    // Seleccionar todo el contenido al abrir
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    refreshSelState();
    // Listener para refrescar estado de la toolbar mientras se mueve el cursor
    const handler = () => refreshSelState();
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSelState = () => {
    if (!ref.current || document.activeElement !== ref.current) return;
    setSelState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
    });
  };

  if (block.content.kind !== 'text') return null;
  const c = block.content;
  const scale = canvasWidthPx / format.width;
  const fontFamily = c.fontFamilyOverride ??
    (c.fontRole === 'sans' ? fonts.sans :
     c.fontRole === 'script' ? fonts.script :
     c.fontRole === 'mono' ? fonts.mono :
     fonts.display);

  const initialHtml = c.runs && c.runs.length > 0
    ? runsToHtml(c.runs)
    : escapeHtml(c.text);

  const exec = (cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough') => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    refreshSelState();
  };

  const commit = () => {
    if (!ref.current) { onDone(); return; }
    const html = ref.current.innerHTML;
    const runs = htmlToRuns(html);
    // Si todo el texto tiene el mismo formato, guardamos plano para simplificar.
    const isUniform = runs.length <= 1 || runs.every((r) =>
      !r.bold && !r.italic && !r.underline && !r.strike && !r.color,
    );
    const plain = runs.map((r) => r.text).join('');
    if (block.content.kind !== 'text') { onDone(); return; }
    update(slideId, block.id, {
      content: {
        ...block.content,
        text: plain,
        runs: isUniform ? undefined : runs,
      },
    });
    onDone();
  };

  const editorStyle: React.CSSProperties = {
    position: 'absolute',
    left: block.rect.x * scale,
    top: block.rect.y * scale,
    width: block.rect.w * scale,
    height: block.rect.h * scale,
    fontFamily,
    fontSize: c.fontSize * scale,
    fontStyle: c.fontStyle ?? 'normal',
    fontWeight: c.fontWeight ?? 400,
    letterSpacing: (c.letterSpacing ?? 0) * scale,
    lineHeight: c.lineHeight ?? 1.15,
    color: c.color,
    textAlign: c.textAlign === 'middle' ? 'center' : c.textAlign === 'end' ? 'right' : 'left',
    background: 'rgba(46,70,200,0.06)',
    border: '2px solid #2E46C8',
    outline: 'none',
    padding: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
    zIndex: 100,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    cursor: 'text',
  };

  return (
    <>
      {/* Toolbar flotante arriba del editor */}
      <FloatingToolbar
        left={block.rect.x * scale}
        top={block.rect.y * scale}
        selState={selState}
        onBold={() => exec('bold')}
        onItalic={() => exec('italic')}
        onUnderline={() => exec('underline')}
        onStrike={() => exec('strikeThrough')}
      />
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        style={editorStyle}
        onMouseUp={refreshSelState}
        onKeyUp={refreshSelState}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onDone(); return; }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { commit(); return; }
          // Ctrl+B / I / U — atajos estándar
          if (e.ctrlKey || e.metaKey) {
            const k = e.key.toLowerCase();
            if (k === 'b') { e.preventDefault(); exec('bold'); return; }
            if (k === 'i') { e.preventDefault(); exec('italic'); return; }
            if (k === 'u') { e.preventDefault(); exec('underline'); return; }
          }
        }}
        onBlur={commit}
      />
    </>
  );
}

// ============================================================
// Toolbar flotante
// ============================================================

function FloatingToolbar({
  left, top, selState, onBold, onItalic, onUnderline, onStrike,
}: {
  left: number;
  top: number;
  selState: { bold: boolean; italic: boolean; underline: boolean; strike: boolean };
  onBold: () => void; onItalic: () => void; onUnderline: () => void; onStrike: () => void;
}) {
  return (
    <div
      onMouseDown={(e) => e.preventDefault()} /* no perder la selección */
      style={{
        position: 'absolute', left, top: Math.max(0, top - 44),
        display: 'flex', gap: 2, padding: 3,
        background: '#14141E', border: `1px solid ${BRAND.blue}`, borderRadius: 6,
        zIndex: 101, boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
      }}
    >
      <TbBtn active={selState.bold}      onClick={onBold}      title="Negrita (Ctrl+B)"><Bold size={12} /></TbBtn>
      <TbBtn active={selState.italic}    onClick={onItalic}    title="Itálica (Ctrl+I)"><Italic size={12} /></TbBtn>
      <TbBtn active={selState.underline} onClick={onUnderline} title="Subrayar (Ctrl+U)"><Underline size={12} /></TbBtn>
      <TbBtn active={selState.strike}    onClick={onStrike}    title="Tachar"><Strikethrough size={12} /></TbBtn>
    </div>
  );
}

function TbBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        width: 26, height: 26, padding: 0,
        background: active ? BRAND.blue : 'transparent',
        border: 'none', borderRadius: 4, color: BRAND.cream,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

// ============================================================
// Serialización runs ↔ HTML
// ============================================================

/** Arma un HTML que refleja los runs — `<strong>`, `<em>`, `<u>`, `<s>`. */
function runsToHtml(runs: TextRun[]): string {
  return runs.map((r) => {
    let html = escapeHtml(r.text);
    if (r.bold) html = `<strong>${html}</strong>`;
    if (r.italic) html = `<em>${html}</em>`;
    if (r.underline) html = `<u>${html}</u>`;
    if (r.strike) html = `<s>${html}</s>`;
    if (r.color) html = `<span style="color:${r.color}">${html}</span>`;
    return html;
  }).join('');
}

/**
 * Recorre el DOM del contentEditable y acumula runs con los atributos de
 * formato heredados. Browsers generan tags variados (`<b>` vs `<strong>`,
 * `<i>` vs `<em>`, span con style, font-weight inline) — los mapeamos todos.
 */
function htmlToRuns(html: string): TextRun[] {
  const container = document.createElement('div');
  container.innerHTML = html;
  const runs: TextRun[] = [];
  walk(container, { bold: false, italic: false, underline: false, strike: false, color: undefined }, runs);
  // Fusionar runs consecutivos con igual formato para mantener el array chico.
  return mergeRuns(runs);
}

function walk(node: Node, inherited: { bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | undefined }, out: TextRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent ?? '';
    if (t) {
      out.push({
        text: t,
        ...(inherited.bold ? { bold: true } : {}),
        ...(inherited.italic ? { italic: true } : {}),
        ...(inherited.underline ? { underline: true } : {}),
        ...(inherited.strike ? { strike: true } : {}),
        ...(inherited.color ? { color: inherited.color } : {}),
      });
    }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  const style = el.style;

  const next = {
    bold: inherited.bold
      || tag === 'B' || tag === 'STRONG'
      || (style.fontWeight !== '' && (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600)),
    italic: inherited.italic || tag === 'I' || tag === 'EM' || style.fontStyle === 'italic',
    underline: inherited.underline || tag === 'U'
      || (style.textDecoration?.includes('underline') ?? false),
    strike: inherited.strike || tag === 'S' || tag === 'STRIKE' || tag === 'DEL'
      || (style.textDecoration?.includes('line-through') ?? false),
    color: style.color && style.color.length > 0 ? style.color : inherited.color,
  };

  // <br> agrega un salto de línea como texto (aunque en este editor los runs
  // no dividen por líneas por ahora — eso se maneja por el wrap del SVG).
  if (tag === 'BR') {
    out.push({ text: '\n', ...(inherited.color ? { color: inherited.color } : {}) });
    return;
  }

  el.childNodes.forEach((child) => walk(child, next, out));
}

function mergeRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last
      && !!last.bold === !!r.bold
      && !!last.italic === !!r.italic
      && !!last.underline === !!r.underline
      && !!last.strike === !!r.strike
      && last.color === r.color) {
      last.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
