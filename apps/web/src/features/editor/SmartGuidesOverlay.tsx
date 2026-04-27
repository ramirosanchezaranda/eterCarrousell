/**
 * Renderiza las smart guides calculadas por `smartGuides.computeSmartGuides`.
 *
 *   - Líneas magenta punteadas para alineaciones (vertical / horizontal).
 *   - Distancias en píxeles a vecinos (labels "12 px" con tick marks).
 *   - Markers "= =" para gaps iguales entre 3 rects.
 *
 * Todo se dibuja en el SVG principal del canvas (mismo viewBox del slide).
 * El consumer pasa `scale` (px-pantalla por unidad-de-slide) para que el
 * stroke width y el font-size de los labels se vean al mismo tamaño visual
 * sin importar el zoom interno.
 */
import type { SmartGuide, DistanceLabel, EqualGapMarker } from './smartGuides';

const GUIDE_COLOR = '#ff3b8b'; // magenta tipo Canva
const LABEL_BG = '#ff3b8b';
const LABEL_FG = '#ffffff';
const LABEL_PADDING_PX = 6;
const LABEL_FONT_PX = 11;
const TICK_LEN_PX = 5;

interface Props {
  guides: ReadonlyArray<SmartGuide>;
  distances: ReadonlyArray<DistanceLabel>;
  equalGaps: ReadonlyArray<EqualGapMarker>;
  /** px-pantalla por unidad-de-slide. Para mantener el grosor visual constante. */
  scale: number;
}

export function SmartGuidesOverlay({ guides, distances, equalGaps, scale }: Props) {
  // Convertimos px-pantalla → unidades-slide dividiendo por scale.
  // Si scale=2 (zoom 2x), 1px de pantalla = 0.5 unidades del slide.
  const strokeW = 1 / scale;
  const dashed = `${4 / scale} ${3 / scale}`;
  const fontSize = LABEL_FONT_PX / scale;
  const tickLen = TICK_LEN_PX / scale;
  const padding = LABEL_PADDING_PX / scale;

  return (
    <g pointerEvents="none">
      {/* Alineación: líneas */}
      {guides.map((g, i) => (
        <Guide key={`g${i}`} guide={g} strokeWidth={strokeW} dashed={dashed} />
      ))}
      {/* Distancias a vecinos */}
      {distances.map((d, i) => (
        <Distance
          key={`d${i}`}
          label={d}
          strokeWidth={strokeW}
          fontSize={fontSize}
          tickLen={tickLen}
          padding={padding}
        />
      ))}
      {/* Equal-gap markers */}
      {equalGaps.map((eg, i) => (
        <EqualGap
          key={`eg${i}`}
          marker={eg}
          strokeWidth={strokeW}
          fontSize={fontSize}
          padding={padding}
        />
      ))}
    </g>
  );
}

function Guide({ guide, strokeWidth, dashed }: { guide: SmartGuide; strokeWidth: number; dashed: string }) {
  if (guide.kind === 'vertical') {
    return (
      <line
        x1={guide.position}
        x2={guide.position}
        y1={guide.extentStart}
        y2={guide.extentEnd}
        stroke={GUIDE_COLOR}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed}
      />
    );
  }
  return (
    <line
      x1={guide.extentStart}
      x2={guide.extentEnd}
      y1={guide.position}
      y2={guide.position}
      stroke={GUIDE_COLOR}
      strokeWidth={strokeWidth}
      strokeDasharray={dashed}
    />
  );
}

function Distance({
  label,
  strokeWidth,
  fontSize,
  tickLen,
  padding,
}: {
  label: DistanceLabel;
  strokeWidth: number;
  fontSize: number;
  tickLen: number;
  padding: number;
}) {
  const text = `${label.pixels} px`;
  // Estimamos ancho: 0.6 * fontSize por carácter (aprox para sans).
  const textWidth = text.length * fontSize * 0.6;
  const boxW = textWidth + padding * 2;
  const boxH = fontSize + padding;

  // Línea de medición
  const line = (
    <line
      x1={label.from.x}
      x2={label.to.x}
      y1={label.from.y}
      y2={label.to.y}
      stroke={GUIDE_COLOR}
      strokeWidth={strokeWidth}
    />
  );

  // Tick marks perpendiculares en los endpoints
  const tickAxis = label.axis === 'x' ? 'y' : 'x';
  const tick = (cx: number, cy: number) =>
    tickAxis === 'y' ? (
      <line
        x1={cx}
        x2={cx}
        y1={cy - tickLen}
        y2={cy + tickLen}
        stroke={GUIDE_COLOR}
        strokeWidth={strokeWidth}
      />
    ) : (
      <line
        x1={cx - tickLen}
        x2={cx + tickLen}
        y1={cy}
        y2={cy}
        stroke={GUIDE_COLOR}
        strokeWidth={strokeWidth}
      />
    );

  return (
    <g>
      {line}
      {tick(label.from.x, label.from.y)}
      {tick(label.to.x, label.to.y)}
      <rect
        x={label.x - boxW / 2}
        y={label.y - boxH / 2}
        width={boxW}
        height={boxH}
        rx={boxH / 2}
        fill={LABEL_BG}
      />
      <text
        x={label.x}
        y={label.y + fontSize * 0.35}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={LABEL_FG}
        fontWeight={600}
      >
        {text}
      </text>
    </g>
  );
}

function EqualGap({
  marker,
  strokeWidth,
  fontSize,
  padding,
}: {
  marker: EqualGapMarker;
  strokeWidth: number;
  fontSize: number;
  padding: number;
}) {
  // Renderizamos cada gap como una línea con tick marks en los extremos
  // y un label "= 12 px" en el centro del primer gap (suficiente para que
  // el usuario entienda que ambos gaps son iguales).
  const text = `= ${marker.pixels} px`;
  const textWidth = text.length * fontSize * 0.6;
  const boxW = textWidth + padding * 2;
  const boxH = fontSize + padding;

  const lines = marker.gaps.map((gap, i) => (
    <g key={i}>
      <line
        x1={gap.from.x}
        x2={gap.to.x}
        y1={gap.from.y}
        y2={gap.to.y}
        stroke={GUIDE_COLOR}
        strokeWidth={strokeWidth}
      />
    </g>
  ));

  // Label en el centro del PRIMER gap
  const first = marker.gaps[0];
  if (!first) return <g>{lines}</g>;
  const cx = (first.from.x + first.to.x) / 2;
  const cy = (first.from.y + first.to.y) / 2;

  return (
    <g>
      {lines}
      <rect
        x={cx - boxW / 2}
        y={cy - boxH / 2}
        width={boxW}
        height={boxH}
        rx={boxH / 2}
        fill={LABEL_BG}
      />
      <text
        x={cx}
        y={cy + fontSize * 0.35}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={LABEL_FG}
        fontWeight={600}
      >
        {text}
      </text>
    </g>
  );
}
