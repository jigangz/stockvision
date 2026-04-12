import { registerOverlay } from 'klinecharts';
import type { OverlayTemplate } from 'klinecharts';

// --- Arrow line overlay ---
const arrowOverlay: OverlayTemplate = {
  name: 'sv_arrow',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const headLen = 12;
    const a1 = angle - Math.PI / 6;
    const a2 = angle + Math.PI / 6;
    return [
      { type: 'line', attrs: { coordinates: [p0, p1] } },
      {
        type: 'line',
        attrs: {
          coordinates: [
            p1,
            { x: p1.x - headLen * Math.cos(a1), y: p1.y - headLen * Math.sin(a1) },
          ],
        },
      },
      {
        type: 'line',
        attrs: {
          coordinates: [
            p1,
            { x: p1.x - headLen * Math.cos(a2), y: p1.y - headLen * Math.sin(a2) },
          ],
        },
      },
    ];
  },
};

// --- Buy mark overlay ---
const buyMarkOverlay: OverlayTemplate = {
  name: 'sv_buyMark',
  totalStep: 2,
  needDefaultPointFigure: false,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 1) return [];
    const p = coordinates[0];
    return [
      {
        type: 'text',
        attrs: { x: p.x, y: p.y - 8, text: 'B', align: 'center', baseline: 'bottom' },
        styles: { color: '#FF4444' },
      },
      {
        type: 'line',
        attrs: { coordinates: [{ x: p.x, y: p.y - 4 }, { x: p.x - 6, y: p.y + 8 }] },
        styles: { color: '#FF4444' },
      },
      {
        type: 'line',
        attrs: { coordinates: [{ x: p.x, y: p.y - 4 }, { x: p.x + 6, y: p.y + 8 }] },
        styles: { color: '#FF4444' },
      },
    ];
  },
};

// --- Sell mark overlay ---
const sellMarkOverlay: OverlayTemplate = {
  name: 'sv_sellMark',
  totalStep: 2,
  needDefaultPointFigure: false,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 1) return [];
    const p = coordinates[0];
    return [
      {
        type: 'text',
        attrs: { x: p.x, y: p.y + 8, text: 'S', align: 'center', baseline: 'top' },
        styles: { color: '#00CC66' },
      },
      {
        type: 'line',
        attrs: { coordinates: [{ x: p.x, y: p.y + 4 }, { x: p.x - 6, y: p.y - 8 }] },
        styles: { color: '#00CC66' },
      },
      {
        type: 'line',
        attrs: { coordinates: [{ x: p.x, y: p.y + 4 }, { x: p.x + 6, y: p.y - 8 }] },
        styles: { color: '#00CC66' },
      },
    ];
  },
};

// --- Flat mark overlay ---
const flatMarkOverlay: OverlayTemplate = {
  name: 'sv_flatMark',
  totalStep: 2,
  needDefaultPointFigure: false,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 1) return [];
    const p = coordinates[0];
    return [
      {
        type: 'text',
        attrs: { x: p.x, y: p.y, text: '—', align: 'center', baseline: 'middle' },
        styles: { color: '#888888' },
      },
    ];
  },
};

// --- Ellipse overlay ---
const ellipseOverlay: OverlayTemplate = {
  name: 'sv_ellipse',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const rx = Math.abs(p1.x - p0.x) / 2;
    return [
      {
        type: 'arc',
        attrs: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, r: rx, startAngle: 0, endAngle: Math.PI * 2 },
      },
    ];
  },
};

// --- Fibonacci Extension ---
const fibExtensionOverlay: OverlayTemplate = {
  name: 'sv_fibExtension',
  totalStep: 4,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 3) return [];
    const [p0, p1, p2] = coordinates;
    const diff = p1.y - p0.y;
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618];
    const figures: unknown[] = [];
    for (const level of levels) {
      const y = p2.y - diff * level;
      figures.push(
        { type: 'line', attrs: { coordinates: [{ x: p0.x, y }, { x: p2.x + 100, y }] } },
        {
          type: 'text',
          attrs: { x: p2.x + 104, y, text: `${(level * 100).toFixed(1)}%`, align: 'left', baseline: 'middle' },
        },
      );
    }
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Measure overlay ---
const measureOverlay: OverlayTemplate = {
  name: 'sv_measure',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const priceDiff = Math.abs(p1.y - p0.y).toFixed(2);
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    return [
      { type: 'line', attrs: { coordinates: [p0, p1] } },
      {
        type: 'text',
        attrs: { x: cx + 4, y: cy, text: `Δ${priceDiff}`, align: 'left', baseline: 'middle' },
        styles: { color: '#FFFF00', size: 11 },
      },
    ];
  },
};

// Simple two-point overlay factory
function createSimpleTwoPointOverlay(name: string): OverlayTemplate {
  return {
    name,
    totalStep: 3,
    needDefaultPointFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return [];
      return [
        { type: 'line', attrs: { coordinates: [coordinates[0], coordinates[1]] } },
        {
          type: 'text',
          attrs: {
            x: coordinates[1].x + 4,
            y: coordinates[1].y,
            text: name.replace('sv_', ''),
            align: 'left',
            baseline: 'middle',
          },
          styles: { color: '#888888', size: 10 },
        },
      ];
    },
  };
}

// --- Gann shared constants ---
const GANN_RATIOS = [
  { ratio: 1 / 8, label: '1×8' },
  { ratio: 1 / 4, label: '1×4' },
  { ratio: 1 / 3, label: '1×3' },
  { ratio: 1 / 2, label: '1×2' },
  { ratio: 1,     label: '1×1' },
  { ratio: 2,     label: '2×1' },
  { ratio: 3,     label: '3×1' },
  { ratio: 4,     label: '4×1' },
  { ratio: 8,     label: '8×1' },
];

const GANN_COLORS = [
  '#FF6666', '#FF9933', '#FFCC00', '#66FF66', '#FFFFFF',
  '#66FF66', '#FFCC00', '#FF9933', '#FF6666',
];

// --- Gann Angle Lines (江恩角度线) ---
// Two points: p0 is pivot, p1 determines direction (4 quadrants).
// 1×1 line goes at 45° in the chosen direction, other lines fan out.
const gannAngleOverlay: OverlayTemplate = {
  name: 'sv_gannAngle',
  totalStep: 3, // two points
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return [];

    // Direction signs determine which quadrant the fan opens toward
    const dirX = dx >= 0 ? 1 : -1;
    const dirY = dy >= 0 ? 1 : -1;

    // 1×1 base slope: 45° in the chosen direction (magnitude 1 in pixel space)
    const baseSlope = dirY / dirX;
    const extendX = dirX * bounding.width * 3;
    const figures: unknown[] = [];

    for (let i = 0; i < GANN_RATIOS.length; i++) {
      const { ratio } = GANN_RATIOS[i];
      const slope = baseSlope * ratio;
      const endX = p0.x + extendX;
      const endY = p0.y + slope * extendX;
      figures.push({
        type: 'line',
        attrs: { coordinates: [p0, { x: endX, y: endY }] },
        styles: { color: GANN_COLORS[i], size: ratio === 1 ? 2 : 1 },
      });
    }
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Gann Fan (江恩扇形) ---
// Two points: p0 is pivot, p1 determines direction.
// Solid lines in chosen direction + dashed mirror in opposite.
const gannFanOverlay: OverlayTemplate = {
  name: 'sv_gannFan',
  totalStep: 3, // two points
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return [];

    const dirX = dx >= 0 ? 1 : -1;
    const dirY = dy >= 0 ? 1 : -1;
    const baseSlope = dirY / dirX;
    const extendX = dirX * bounding.width * 3;
    const figures: unknown[] = [];

    // Primary fan in chosen direction (solid)
    for (let i = 0; i < GANN_RATIOS.length; i++) {
      const { ratio } = GANN_RATIOS[i];
      const slope = baseSlope * ratio;
      figures.push({
        type: 'line',
        attrs: { coordinates: [p0, { x: p0.x + extendX, y: p0.y + slope * extendX }] },
        styles: { color: GANN_COLORS[i], size: ratio === 1 ? 2 : 1 },
      });
    }

    // Mirror fan in opposite Y direction (dashed)
    const mirrorSlope = -dirY / dirX;
    for (let i = 0; i < GANN_RATIOS.length; i++) {
      const { ratio } = GANN_RATIOS[i];
      const slope = mirrorSlope * ratio;
      figures.push({
        type: 'line',
        attrs: { coordinates: [p0, { x: p0.x + extendX, y: p0.y + slope * extendX }] },
        styles: { color: GANN_COLORS[i], size: 1, style: 'dashed', dashedValue: [4, 4] },
      });
    }
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Gann Grid (江恩网格) ---
// Draws a grid of parallel Gann angle lines at the 1×1 ratio.
const gannGridOverlay: OverlayTemplate = {
  name: 'sv_gannGrid',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    if (Math.abs(dx) < 1) return [];

    const baseSlope = dy / dx;
    const spacing = Math.sqrt(dx * dx + dy * dy);
    const extendX = bounding.width * 2;
    const gridCount = 8;
    const figures: unknown[] = [];

    // Rising parallel lines
    for (let i = -gridCount; i <= gridCount; i++) {
      const offsetY = i * spacing * 0.5;
      const startY = p0.y + offsetY;
      figures.push({
        type: 'line',
        attrs: { coordinates: [{ x: p0.x, y: startY }, { x: p0.x + extendX, y: startY + baseSlope * extendX }] },
        styles: { color: i === 0 ? '#FFFFFF' : '#555555', size: i === 0 ? 2 : 1 },
      });
    }

    // Falling parallel lines (perpendicular angle)
    const perpSlope = -1 / baseSlope;
    for (let i = -gridCount; i <= gridCount; i++) {
      const offsetX = i * spacing * 0.5;
      const startX = p0.x + offsetX;
      figures.push({
        type: 'line',
        attrs: { coordinates: [{ x: startX, y: p0.y }, { x: startX + extendX, y: p0.y + perpSlope * extendX }] },
        styles: { color: i === 0 ? '#FFFFFF' : '#555555', size: i === 0 ? 2 : 1 },
      });
    }
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Gann Square (江恩正方) ---
// Draws a box based on 2 points with diagonal lines.
const gannSquareOverlay: OverlayTemplate = {
  name: 'sv_gannSquare',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const figures: unknown[] = [];

    // Rectangle
    figures.push({
      type: 'rect',
      attrs: { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y), width: Math.abs(p1.x - p0.x), height: Math.abs(p1.y - p0.y) },
      styles: { color: 'rgba(255,255,255,0.05)', borderColor: '#AAAAAA', borderSize: 1 },
    });

    // Diagonal lines
    figures.push(
      { type: 'line', attrs: { coordinates: [p0, p1] }, styles: { color: '#FFFF00' } },
      { type: 'line', attrs: { coordinates: [{ x: p0.x, y: p1.y }, { x: p1.x, y: p0.y }] }, styles: { color: '#FFFF00' } },
    );

    // Cross lines
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    figures.push(
      { type: 'line', attrs: { coordinates: [{ x: cx, y: p0.y }, { x: cx, y: p1.y }] }, styles: { color: '#888888', style: 'dashed', dashedValue: [4, 4] } },
      { type: 'line', attrs: { coordinates: [{ x: p0.x, y: cy }, { x: p1.x, y: cy }] }, styles: { color: '#888888', style: 'dashed', dashedValue: [4, 4] } },
    );
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Speed Resistance Lines (速度阻力线) ---
const speedResistanceOverlay: OverlayTemplate = {
  name: 'sv_speedResistance',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const extendX = bounding.width * 2;
    const figures: unknown[] = [];
    const thirds = [1 / 3, 2 / 3, 1];
    const colors = ['#FF6666', '#66FF66', '#FFFFFF'];

    for (let i = 0; i < thirds.length; i++) {
      const slope = (dy * thirds[i]) / dx;
      figures.push({
        type: 'line',
        attrs: { coordinates: [p0, { x: p0.x + extendX, y: p0.y + slope * extendX }] },
        styles: { color: colors[i], size: 1 },
      });
    }
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Percent Lines (百分比线) ---
const percentLineOverlay: OverlayTemplate = {
  name: 'sv_percentLine',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const levels = [0, 0.25, 0.333, 0.5, 0.667, 0.75, 1.0];
    const width = Math.abs(p1.x - p0.x) + 100;
    const left = Math.min(p0.x, p1.x);
    const figures: unknown[] = [];
    for (const lvl of levels) {
      const y = p0.y + (p1.y - p0.y) * lvl;
      figures.push(
        { type: 'line', attrs: { coordinates: [{ x: left, y }, { x: left + width, y }] } },
        { type: 'text', attrs: { x: left + width + 4, y, text: `${(lvl * 100).toFixed(1)}%`, align: 'left', baseline: 'middle' }, styles: { color: '#CCCCCC', size: 10 } },
      );
    }
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Cycle Lines (周期线) ---
const cycleLineOverlay: OverlayTemplate = {
  name: 'sv_cycleLine',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const interval = Math.abs(p1.x - p0.x);
    if (interval < 2) return [];
    const count = Math.ceil(bounding.width / interval) + 1;
    const figures: unknown[] = [];
    for (let i = 0; i <= count; i++) {
      const x = p0.x + interval * i;
      figures.push({
        type: 'line',
        attrs: { coordinates: [{ x, y: 0 }, { x, y: bounding.height }] },
        styles: { color: i === 0 ? '#FFFFFF' : '#555555', size: 1, style: i === 0 ? 'solid' : 'dashed', dashedValue: [4, 4] },
      });
    }
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Pitchfork (安德鲁音叉) ---
const pitchforkOverlay: OverlayTemplate = {
  name: 'sv_pitchfork',
  totalStep: 4,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length < 3) return [];
    const [p0, p1, p2] = coordinates;
    // Median point between p1 and p2
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const dx = mid.x - p0.x;
    const dy = mid.y - p0.y;
    if (Math.abs(dx) < 1) return [];
    const slope = dy / dx;
    const extendX = bounding.width * 2;

    // Median line from p0 through mid
    const medEnd = { x: p0.x + extendX, y: p0.y + slope * extendX };
    // Upper parallel through p1
    const upperEnd = { x: p1.x + extendX, y: p1.y + slope * extendX };
    // Lower parallel through p2
    const lowerEnd = { x: p2.x + extendX, y: p2.y + slope * extendX };

    return [
      { type: 'line', attrs: { coordinates: [p0, medEnd] }, styles: { color: '#FFFFFF', size: 2 } },
      { type: 'line', attrs: { coordinates: [p1, upperEnd] }, styles: { color: '#66FF66' } },
      { type: 'line', attrs: { coordinates: [p2, lowerEnd] }, styles: { color: '#FF6666' } },
      { type: 'line', attrs: { coordinates: [p1, p2] }, styles: { color: '#888888', style: 'dashed', dashedValue: [4, 4] } },
    ] as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Fibonacci Fan (斐波那契扇形) ---
const fibFanOverlay: OverlayTemplate = {
  name: 'sv_fibFan',
  totalStep: 3,
  needDefaultPointFigure: true,
  createPointFigures: ({ coordinates, bounding }) => {
    if (coordinates.length < 2) return [];
    const [p0, p1] = coordinates;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const extendX = bounding.width * 2;
    const levels = [0.236, 0.382, 0.5, 0.618, 0.786];
    const figures: unknown[] = [];

    // Base line
    figures.push({ type: 'line', attrs: { coordinates: [p0, { x: p0.x + extendX, y: p0.y + (dy / dx) * extendX }] }, styles: { color: '#FFFFFF' } });

    for (const lvl of levels) {
      const targetY = p0.y + dy * lvl;
      const slope = (targetY - p0.y) / dx;
      figures.push({
        type: 'line',
        attrs: { coordinates: [p0, { x: p0.x + extendX, y: p0.y + slope * extendX }] },
        styles: { color: '#888888', style: 'dashed', dashedValue: [4, 4] },
      });
      figures.push({
        type: 'text',
        attrs: { x: p1.x, y: p0.y + slope * dx - 8, text: `${(lvl * 100).toFixed(1)}%`, align: 'left', baseline: 'bottom' },
        styles: { color: '#AAAAAA', size: 9 },
      });
    }
    return figures as ReturnType<NonNullable<OverlayTemplate['createPointFigures']>>;
  },
};

// --- Remaining simple overlays ---
const additionalOverlays: OverlayTemplate[] = [
  createSimpleTwoPointOverlay('sv_arc'),
  createSimpleTwoPointOverlay('sv_regressionChannel'),
  createSimpleTwoPointOverlay('sv_fibArc'),
  createSimpleTwoPointOverlay('sv_fibTimezone'),
];

/**
 * Register all custom overlays with KLineChart.
 * Call once before creating any chart instance.
 */
export function registerCustomOverlays(): void {
  const allOverlays = [
    arrowOverlay,
    buyMarkOverlay,
    sellMarkOverlay,
    flatMarkOverlay,
    ellipseOverlay,
    fibExtensionOverlay,
    measureOverlay,
    gannAngleOverlay,
    gannFanOverlay,
    gannGridOverlay,
    gannSquareOverlay,
    speedResistanceOverlay,
    percentLineOverlay,
    cycleLineOverlay,
    pitchforkOverlay,
    fibFanOverlay,
    ...additionalOverlays,
  ];

  for (const overlay of allOverlays) {
    registerOverlay(overlay);
  }
}
