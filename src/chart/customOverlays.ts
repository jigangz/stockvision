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

const additionalOverlays: OverlayTemplate[] = [
  createSimpleTwoPointOverlay('sv_arc'),
  createSimpleTwoPointOverlay('sv_pitchfork'),
  createSimpleTwoPointOverlay('sv_regressionChannel'),
  createSimpleTwoPointOverlay('sv_fibFan'),
  createSimpleTwoPointOverlay('sv_fibArc'),
  createSimpleTwoPointOverlay('sv_fibTimezone'),
  createSimpleTwoPointOverlay('sv_gannAngle'),
  createSimpleTwoPointOverlay('sv_gannFan'),
  createSimpleTwoPointOverlay('sv_gannGrid'),
  createSimpleTwoPointOverlay('sv_gannSquare'),
  createSimpleTwoPointOverlay('sv_speedResistance'),
  createSimpleTwoPointOverlay('sv_percentLine'),
  createSimpleTwoPointOverlay('sv_cycleLine'),
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
    ...additionalOverlays,
  ];

  for (const overlay of allOverlays) {
    registerOverlay(overlay);
  }
}
