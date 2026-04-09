import { useEffect, useRef, useCallback } from 'react';
import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts';
import {
  useDrawingStore,
  type Drawing,
  type DrawingPoint,
  type DrawingStyle,
} from '@/stores/drawingStore';

interface Props {
  chart: IChartApi | null;
  series: ISeriesApi<SeriesType> | null;
}

function applyLineStyle(
  ctx: CanvasRenderingContext2D,
  style: DrawingStyle['lineStyle'],
  lineWidth: number,
) {
  if (style === 'dashed') ctx.setLineDash([8 * lineWidth, 4 * lineWidth]);
  else if (style === 'dotted') ctx.setLineDash([2 * lineWidth, 3 * lineWidth]);
  else ctx.setLineDash([]);
}

/** Convert stored point (price-time) → canvas pixel coords */
function toPixel(
  point: DrawingPoint,
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
): { x: number; y: number } | null {
  const x = chart.timeScale().timeToCoordinate(point.time as Time);
  const y = series.priceToCoordinate(point.price);
  if (x === null || y === null) return null;
  return { x, y };
}

/** Convert canvas pixel coords → price-time point */
function toPoint(
  x: number,
  y: number,
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
): DrawingPoint | null {
  const time = chart.timeScale().coordinateToTime(x);
  const price = series.coordinateToPrice(y);
  if (time === null || price === null) return null;
  return { time: time as number, price };
}

/** Find the farthest point in direction (dx, dy) from p0 within canvas bounds */
function extendRay(
  p0: { x: number; y: number },
  dx: number,
  dy: number,
  w: number,
  h: number,
): { x: number; y: number } {
  let tMax = 1e9;
  if (dx > 0) tMax = Math.min(tMax, (w - p0.x) / dx);
  else if (dx < 0) tMax = Math.min(tMax, (-p0.x) / dx);
  if (dy > 0) tMax = Math.min(tMax, (h - p0.y) / dy);
  else if (dy < 0) tMax = Math.min(tMax, (-p0.y) / dy);
  if (tMax <= 0) return p0;
  return { x: p0.x + tMax * dx, y: p0.y + tMax * dy };
}

/** Extend a line through p0 and p1 to both canvas edges */
function extendLineFull(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  w: number,
  h: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  return [extendRay(p0, -dx, -dy, w, h), extendRay(p0, dx, dy, w, h)];
}

const FIB_LEVELS = [
  { level: 0, label: '0.0%' },
  { level: 0.236, label: '23.6%' },
  { level: 0.382, label: '38.2%' },
  { level: 0.5, label: '50.0%' },
  { level: 0.618, label: '61.8%' },
  { level: 0.786, label: '78.6%' },
  { level: 1.0, label: '100.0%' },
];

const FIB_FAN_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const FIB_ARC_LEVELS = [0.382, 0.5, 0.618, 1.0];
const FIB_TZ_SEQUENCE = [1, 2, 3, 5, 8, 13, 21, 34, 55];

const GANN_ANGLES = [
  { rY: 2, rX: 1, label: '1×2' },
  { rY: 1, rX: 1, label: '1×1' },
  { rY: 1, rX: 2, label: '2×1' },
];

// Full Gann Fan angles (8 angles + 1×1 center)
const GANN_FAN_ANGLES = [
  { rY: 8, rX: 1, label: '1×8', color: '#FF4444' },
  { rY: 4, rX: 1, label: '1×4', color: '#FF8844' },
  { rY: 3, rX: 1, label: '1×3', color: '#FFCC44' },
  { rY: 2, rX: 1, label: '1×2', color: '#FFFF44' },
  { rY: 1, rX: 1, label: '1×1', color: '#FFFFFF' },
  { rY: 1, rX: 2, label: '2×1', color: '#44FF44' },
  { rY: 1, rX: 3, label: '3×1', color: '#44CCFF' },
  { rY: 1, rX: 4, label: '4×1', color: '#4488FF' },
  { rY: 1, rX: 8, label: '8×1', color: '#8844FF' },
];

const FIB_EXT_LEVELS = [
  { level: 0, label: '0.0%' },
  { level: 0.236, label: '23.6%' },
  { level: 0.382, label: '38.2%' },
  { level: 0.5, label: '50.0%' },
  { level: 0.618, label: '61.8%' },
  { level: 1.0, label: '100.0%' },
  { level: 1.272, label: '127.2%' },
  { level: 1.618, label: '161.8%' },
  { level: 2.0, label: '200.0%' },
  { level: 2.618, label: '261.8%' },
];

const SPEED_LEVELS = [1 / 3, 2 / 3];
const PERCENT_LEVELS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

function renderDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  canvasWidth: number,
  canvasHeight: number,
) {
  ctx.strokeStyle = drawing.style.color;
  ctx.lineWidth = drawing.style.lineWidth;
  applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
  ctx.globalAlpha = 1.0;

  const pts = drawing.points.map((p) => toPixel(p, chart, series));

  if (drawing.type === 'horizontal') {
    const p = pts[0];
    if (!p) return;
    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(canvasWidth, p.y);
    ctx.stroke();

  } else if (drawing.type === 'vertical') {
    const p = pts[0];
    if (!p) return;
    ctx.beginPath();
    ctx.moveTo(p.x, 0);
    ctx.lineTo(p.x, canvasHeight);
    ctx.stroke();

  } else if (drawing.type === 'trendline') {
    // Extends through both p0 and p1 to canvas edges
    if (!pts[0] || !pts[1]) return;
    const [start, end] = extendLineFull(pts[0], pts[1], canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

  } else if (drawing.type === 'segment') {
    if (!pts[0] || !pts[1]) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();

  } else if (drawing.type === 'ray') {
    if (!pts[0] || !pts[1]) return;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const end = extendRay(pts[0], dx, dy, canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

  } else if (drawing.type === 'channel') {
    if (!pts[0] || !pts[1]) return;
    // Main trendline
    const [s1, e1] = extendLineFull(pts[0], pts[1], canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.stroke();

    if (!pts[2]) return;
    // Parallel line through p2
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    // Normal vector
    const nx = -dy / len;
    const ny = dx / len;
    const offset = (pts[2].x - pts[0].x) * nx + (pts[2].y - pts[0].y) * ny;
    const p2a = { x: pts[0].x + offset * nx, y: pts[0].y + offset * ny };
    const p2b = { x: pts[1].x + offset * nx, y: pts[1].y + offset * ny };
    const [s2, e2] = extendLineFull(p2a, p2b, canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(s2.x, s2.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.stroke();

    // Dashed fill connecting lines at ends
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.moveTo(e1.x, e1.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.stroke();
    ctx.restore();

  } else if (drawing.type === 'fibRetracement') {
    if (!pts[0] || !pts[1]) return;
    const xLeft = 0;
    const xRight = canvasWidth;
    const priceHigh = drawing.points[0].price;
    const priceLow = drawing.points[1].price;
    const priceRange = priceHigh - priceLow;

    ctx.save();
    ctx.font = `10px monospace`;
    for (const { level, label } of FIB_LEVELS) {
      const levelPrice = priceLow + priceRange * (1 - level);
      const y = series.priceToCoordinate(levelPrice);
      if (y === null) continue;

      // Color-code key levels
      if (level === 0.618 || level === 0.5) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = drawing.style.lineWidth + 0.5;
      } else {
        ctx.strokeStyle = drawing.style.color;
        ctx.lineWidth = drawing.style.lineWidth;
      }
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);

      ctx.beginPath();
      ctx.moveTo(xLeft, y);
      ctx.lineTo(xRight, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(label, xRight - 44, y - 2);
    }
    ctx.restore();

  } else if (drawing.type === 'gannAngle') {
    if (!pts[0] || !pts[1]) return;
    const anchor = pts[0];
    // Direction: determine sign from p1 vs p0
    const signX = pts[1].x >= pts[0].x ? 1 : -1;
    const signY = pts[1].y <= pts[0].y ? -1 : 1; // up = negative y in canvas

    // Base unit: distance from anchor to p1 in pixels defines 1 time unit
    const baseDx = Math.abs(pts[1].x - pts[0].x) || 40;

    ctx.save();
    ctx.font = '9px monospace';
    for (const { rY, rX, label } of GANN_ANGLES) {
      const unitDx = signX * baseDx;
      const unitDy = -signY * baseDx * (rY / rX);

      const end = extendRay(anchor, unitDx, unitDy, canvasWidth, canvasHeight);
      ctx.strokeStyle = drawing.style.color;
      ctx.lineWidth = drawing.style.lineWidth;
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      ctx.fillStyle = drawing.style.color;
      ctx.fillText(label, end.x + (signX > 0 ? 2 : -24), end.y - 2);
    }
    // Anchor dot
    ctx.fillStyle = drawing.style.color;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (drawing.type === 'rectangle') {
    if (!pts[0] || !pts[1]) return;
    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    const w = Math.abs(pts[1].x - pts[0].x);
    const h = Math.abs(pts[1].y - pts[0].y);
    ctx.fillStyle = drawing.style.color + '22';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

  } else if (drawing.type === 'text') {
    const p = pts[0];
    if (!p) return;
    const txt = drawing.text ?? '';
    if (!txt) return;
    ctx.save();
    const fontSize = 11 + drawing.style.lineWidth;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = drawing.style.color;
    // Background
    const metrics = ctx.measureText(txt);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - 2, p.y - fontSize - 2, metrics.width + 4, fontSize + 4);
    ctx.fillStyle = drawing.style.color;
    ctx.fillText(txt, p.x, p.y);
    ctx.restore();

  } else if (drawing.type === 'buyMark') {
    const p = pts[0];
    if (!p) return;
    const size = 7 + drawing.style.lineWidth;
    ctx.save();
    ctx.fillStyle = drawing.style.color;
    ctx.strokeStyle = drawing.style.color;
    ctx.setLineDash([]);
    // Arrow stem
    ctx.lineWidth = drawing.style.lineWidth;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + size);
    ctx.stroke();
    // Upward triangle (pointing up, below the price)
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + size);
    ctx.lineTo(p.x - size, p.y + size * 2.2);
    ctx.lineTo(p.x + size, p.y + size * 2.2);
    ctx.closePath();
    ctx.fill();
    // "B" label
    ctx.fillStyle = '#000';
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', p.x, p.y + size * 1.6);
    ctx.restore();

  } else if (drawing.type === 'sellMark') {
    const p = pts[0];
    if (!p) return;
    const size = 7 + drawing.style.lineWidth;
    ctx.save();
    ctx.fillStyle = drawing.style.color;
    ctx.strokeStyle = drawing.style.color;
    ctx.setLineDash([]);
    // Arrow stem upward
    ctx.lineWidth = drawing.style.lineWidth;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - size);
    ctx.stroke();
    // Downward triangle (pointing down, above the price)
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - size);
    ctx.lineTo(p.x - size, p.y - size * 2.2);
    ctx.lineTo(p.x + size, p.y - size * 2.2);
    ctx.closePath();
    ctx.fill();
    // "S" label
    ctx.fillStyle = '#000';
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', p.x, p.y - size * 1.6);
    ctx.restore();

  } else if (drawing.type === 'flatMark') {
    const p = pts[0];
    if (!p) return;
    const size = 7 + drawing.style.lineWidth;
    ctx.save();
    ctx.fillStyle = drawing.style.color;
    ctx.strokeStyle = drawing.style.color;
    ctx.setLineDash([]);
    ctx.lineWidth = drawing.style.lineWidth;
    // Circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Horizontal bars on sides
    ctx.beginPath();
    ctx.moveTo(p.x - size * 1.5, p.y);
    ctx.lineTo(p.x - size * 0.7, p.y);
    ctx.moveTo(p.x + size * 0.7, p.y);
    ctx.lineTo(p.x + size * 1.5, p.y);
    ctx.stroke();
    // "=" label
    ctx.fillStyle = '#000';
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('=', p.x, p.y);
    ctx.restore();

  } else if (drawing.type === 'parallel_line') {
    // Two parallel lines: first through p0→p1, second through p2 parallel to it
    if (!pts[0] || !pts[1]) return;
    const [s1, e1] = extendLineFull(pts[0], pts[1], canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.stroke();
    if (!pts[2]) return;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = -dy / len;
    const ny = dx / len;
    const offset = (pts[2].x - pts[0].x) * nx + (pts[2].y - pts[0].y) * ny;
    const p2a = { x: pts[0].x + offset * nx, y: pts[0].y + offset * ny };
    const p2b = { x: pts[1].x + offset * nx, y: pts[1].y + offset * ny };
    const [s2, e2] = extendLineFull(p2a, p2b, canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(s2.x, s2.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.stroke();

  } else if (drawing.type === 'price_line') {
    // Horizontal line with price label on right
    const p = pts[0];
    if (!p) return;
    ctx.beginPath();
    ctx.moveTo(0, p.y);
    ctx.lineTo(canvasWidth, p.y);
    ctx.stroke();
    // Price label
    ctx.save();
    const price = drawing.points[0].price;
    const label = price.toFixed(2);
    ctx.font = '10px monospace';
    const metrics = ctx.measureText(label);
    ctx.fillStyle = drawing.style.color;
    ctx.fillRect(canvasWidth - metrics.width - 6, p.y - 8, metrics.width + 4, 14);
    ctx.fillStyle = '#000';
    ctx.fillText(label, canvasWidth - metrics.width - 4, p.y + 3);
    ctx.restore();

  } else if (drawing.type === 'arrow') {
    // Line with arrowhead at p1
    if (!pts[0] || !pts[1]) return;
    const { x: x0, y: y0 } = pts[0];
    const { x: x1, y: y1 } = pts[1];
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // Arrowhead
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const headLen = 10 + drawing.style.lineWidth * 2;
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
    ctx.restore();

  } else if (drawing.type === 'arc') {
    // Semicircular arc with p0 and p1 as endpoints
    if (!pts[0] || !pts[1]) return;
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;
    const r = Math.sqrt((pts[1].x - pts[0].x) ** 2 + (pts[1].y - pts[0].y) ** 2) / 2;
    const baseAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    ctx.beginPath();
    ctx.arc(cx, cy, r, baseAngle + Math.PI, baseAngle, false);
    ctx.stroke();

  } else if (drawing.type === 'fib_fan') {
    // Fan lines from p0 through Fibonacci ratios of the vertical range at p1.x
    if (!pts[0] || !pts[1]) return;
    const anchor = pts[0];
    const targetX = pts[1].x;
    const yRange = pts[1].y - pts[0].y;
    ctx.save();
    ctx.font = '9px monospace';
    for (const level of FIB_FAN_LEVELS) {
      const targetY = anchor.y + level * yRange;
      const dx = targetX - anchor.x;
      const dy = targetY - anchor.y;
      const end = extendRay(anchor, dx, dy, canvasWidth, canvasHeight);
      ctx.strokeStyle = drawing.style.color;
      ctx.lineWidth = drawing.style.lineWidth;
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.fillStyle = drawing.style.color;
      ctx.fillText(`${(level * 100).toFixed(1)}%`, end.x + 2, end.y - 2);
    }
    ctx.restore();

  } else if (drawing.type === 'fib_arc') {
    // Arcs centered at p0 at Fibonacci ratios of distance(p0, p1)
    if (!pts[0] || !pts[1]) return;
    const cx = pts[0].x;
    const cy = pts[0].y;
    const baseR = Math.sqrt((pts[1].x - cx) ** 2 + (pts[1].y - cy) ** 2);
    ctx.save();
    ctx.font = '9px monospace';
    for (const level of FIB_ARC_LEVELS) {
      const r = baseR * level;
      ctx.strokeStyle = drawing.style.color;
      ctx.lineWidth = drawing.style.lineWidth;
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = drawing.style.color;
      ctx.fillText(`${(level * 100).toFixed(1)}%`, cx + r + 2, cy - 2);
    }
    // Anchor dot
    ctx.fillStyle = drawing.style.color;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (drawing.type === 'fib_timezone') {
    // Vertical lines at Fibonacci multiples of the base unit (p0→p1 distance in pixels)
    if (!pts[0] || !pts[1]) return;
    const baseUnit = pts[1].x - pts[0].x;
    if (Math.abs(baseUnit) < 1) return;
    ctx.save();
    ctx.font = '9px monospace';
    ctx.fillStyle = drawing.style.color;
    // Draw base line at p0
    ctx.strokeStyle = drawing.style.color;
    ctx.lineWidth = drawing.style.lineWidth;
    applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, 0);
    ctx.lineTo(pts[0].x, canvasHeight);
    ctx.stroke();
    for (let i = 0; i < FIB_TZ_SEQUENCE.length; i++) {
      const xPos = pts[0].x + FIB_TZ_SEQUENCE[i] * baseUnit;
      if (xPos < 0 || xPos > canvasWidth) continue;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, canvasHeight);
      ctx.stroke();
      ctx.fillText(String(FIB_TZ_SEQUENCE[i]), xPos + 2, 12);
    }
    ctx.restore();

  } else if (drawing.type === 'gannFan') {
    // Full Gann Fan: 9 angle lines from anchor
    if (!pts[0] || !pts[1]) return;
    const anchor = pts[0];
    const signX = pts[1].x >= pts[0].x ? 1 : -1;
    const signY = pts[1].y <= pts[0].y ? -1 : 1;
    const baseDx = Math.abs(pts[1].x - pts[0].x) || 40;

    ctx.save();
    ctx.font = '9px monospace';
    for (const { rY, rX, label, color } of GANN_FAN_ANGLES) {
      const unitDx = signX * baseDx;
      const unitDy = -signY * baseDx * (rY / rX);
      const end = extendRay(anchor, unitDx, unitDy, canvasWidth, canvasHeight);
      ctx.strokeStyle = color;
      ctx.lineWidth = label === '1×1' ? drawing.style.lineWidth + 1 : drawing.style.lineWidth;
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(label, end.x + (signX > 0 ? 2 : -28), end.y - 2);
    }
    ctx.fillStyle = drawing.style.color;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (drawing.type === 'gannGrid') {
    // Gann Grid: grid of 45-degree lines between two points
    if (!pts[0] || !pts[1]) return;
    const x0 = Math.min(pts[0].x, pts[1].x);
    const x1 = Math.max(pts[0].x, pts[1].x);
    const y0 = Math.min(pts[0].y, pts[1].y);
    const y1 = Math.max(pts[0].y, pts[1].y);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 2 || h < 2) return;

    ctx.save();
    // Bounding box
    ctx.strokeStyle = drawing.style.color;
    ctx.lineWidth = drawing.style.lineWidth;
    applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
    ctx.strokeRect(x0, y0, w, h);

    // Diagonal grid lines (upward and downward)
    const step = Math.min(w, h) / 4;
    ctx.globalAlpha = 0.5;
    // Rising lines (bottom-left to top-right direction)
    for (let i = -8; i <= 8; i++) {
      const startX = x0 + i * step;
      ctx.beginPath();
      ctx.moveTo(Math.max(x0, startX), Math.min(y1, y1 - (Math.max(x0, startX) - startX)));
      // Simple 45-degree lines clipped to box
      const fromX = Math.max(x0, startX);
      const fromY = y1;
      const toX = fromX + h;
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(Math.min(x1, toX), Math.max(y0, fromY - (Math.min(x1, toX) - fromX)));
      ctx.stroke();
    }
    // Falling lines (top-left to bottom-right direction)
    for (let i = -8; i <= 8; i++) {
      const startX = x0 + i * step;
      const fromX = Math.max(x0, startX);
      const fromY = y0;
      const toX = fromX + h;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(Math.min(x1, toX), Math.min(y1, fromY + (Math.min(x1, toX) - fromX)));
      ctx.stroke();
    }
    ctx.restore();

  } else if (drawing.type === 'gannSquare') {
    // Gann Square: square grid with diagonals and subdivisions
    if (!pts[0] || !pts[1]) return;
    const cx = pts[0].x;
    const cy = pts[0].y;
    const size = Math.max(Math.abs(pts[1].x - pts[0].x), Math.abs(pts[1].y - pts[0].y));
    if (size < 4) return;
    const half = size / 2;

    ctx.save();
    ctx.strokeStyle = drawing.style.color;
    ctx.lineWidth = drawing.style.lineWidth;
    applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);

    // Outer square
    ctx.strokeRect(cx - half, cy - half, size, size);
    // Cross (horizontal + vertical center lines)
    ctx.beginPath();
    ctx.moveTo(cx - half, cy); ctx.lineTo(cx + half, cy);
    ctx.moveTo(cx, cy - half); ctx.lineTo(cx, cy + half);
    ctx.stroke();
    // Diagonals
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx + half, cy + half);
    ctx.moveTo(cx + half, cy - half); ctx.lineTo(cx - half, cy + half);
    ctx.stroke();
    // Inner subdivisions (quarter lines)
    ctx.globalAlpha = 0.4;
    const quarter = half / 2;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - quarter); ctx.lineTo(cx + half, cy - quarter);
    ctx.moveTo(cx - half, cy + quarter); ctx.lineTo(cx + half, cy + quarter);
    ctx.moveTo(cx - quarter, cy - half); ctx.lineTo(cx - quarter, cy + half);
    ctx.moveTo(cx + quarter, cy - half); ctx.lineTo(cx + quarter, cy + half);
    ctx.stroke();
    // Center dot
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = drawing.style.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (drawing.type === 'pitchfork') {
    // Andrews' Pitchfork: median line + 2 parallel lines
    if (!pts[0] || !pts[1] || !pts[2]) return;
    // Median point of p1-p2
    const midX = (pts[1].x + pts[2].x) / 2;
    const midY = (pts[1].y + pts[2].y) / 2;
    // Median line: p0 → mid
    const [ms, me] = extendLineFull(pts[0], { x: midX, y: midY }, canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(ms.x, ms.y);
    ctx.lineTo(me.x, me.y);
    ctx.stroke();
    // Upper prong through p1 parallel to median
    const dx = midX - pts[0].x;
    const dy = midY - pts[0].y;
    const p1end = { x: pts[1].x + dx * 10, y: pts[1].y + dy * 10 };
    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    ctx.lineTo(p1end.x, p1end.y);
    ctx.stroke();
    // Lower prong through p2 parallel to median
    const p2end = { x: pts[2].x + dx * 10, y: pts[2].y + dy * 10 };
    ctx.beginPath();
    ctx.moveTo(pts[2].x, pts[2].y);
    ctx.lineTo(p2end.x, p2end.y);
    ctx.stroke();
    // Connect p1-p2
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.stroke();
    ctx.restore();

  } else if (drawing.type === 'fibExtension') {
    // Fibonacci Extension: levels beyond 100%
    if (!pts[0] || !pts[1]) return;
    const xLeft = 0;
    const xRight = canvasWidth;
    const priceHigh = drawing.points[0].price;
    const priceLow = drawing.points[1].price;
    const priceRange = priceHigh - priceLow;

    ctx.save();
    ctx.font = '10px monospace';
    for (const { level, label } of FIB_EXT_LEVELS) {
      const levelPrice = priceLow + priceRange * (1 - level);
      const y = series.priceToCoordinate(levelPrice);
      if (y === null) continue;

      if (level === 1.618 || level === 1.0) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = drawing.style.lineWidth + 0.5;
      } else if (level > 1.0) {
        ctx.strokeStyle = '#FF6600';
        ctx.lineWidth = drawing.style.lineWidth;
      } else {
        ctx.strokeStyle = drawing.style.color;
        ctx.lineWidth = drawing.style.lineWidth;
      }
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
      ctx.beginPath();
      ctx.moveTo(xLeft, y);
      ctx.lineTo(xRight, y);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(label, xRight - 50, y - 2);
    }
    ctx.restore();

  } else if (drawing.type === 'speedResistance') {
    // Speed Resistance Lines: from p0, through 1/3 and 2/3 of p0-p1 vertical range
    if (!pts[0] || !pts[1]) return;
    const anchor = pts[0];
    ctx.save();
    ctx.font = '9px monospace';
    // Base line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    // Speed lines at 1/3 and 2/3
    for (const level of SPEED_LEVELS) {
      const targetY = pts[0].y + level * (pts[1].y - pts[0].y);
      const dx = pts[1].x - anchor.x;
      const dy = targetY - anchor.y;
      const end = extendRay(anchor, dx, dy, canvasWidth, canvasHeight);
      ctx.strokeStyle = drawing.style.color;
      ctx.lineWidth = drawing.style.lineWidth;
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.fillStyle = drawing.style.color;
      ctx.fillText(`${(level * 100).toFixed(0)}%`, end.x + 2, end.y - 2);
    }
    ctx.restore();

  } else if (drawing.type === 'percentLine') {
    // Percentage Lines: horizontal lines at 0%, 12.5%, 25%, ... 100%
    if (!pts[0] || !pts[1]) return;
    const priceTop = drawing.points[0].price;
    const priceBot = drawing.points[1].price;
    const priceRange = priceTop - priceBot;

    ctx.save();
    ctx.font = '10px monospace';
    for (const level of PERCENT_LEVELS) {
      const price = priceBot + priceRange * (1 - level);
      const y = series.priceToCoordinate(price);
      if (y === null) continue;
      ctx.strokeStyle = level === 0.5 ? '#FFD700' : drawing.style.color;
      ctx.lineWidth = level === 0.5 ? drawing.style.lineWidth + 0.5 : drawing.style.lineWidth;
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(`${(level * 100).toFixed(1)}%`, canvasWidth - 50, y - 2);
    }
    ctx.restore();

  } else if (drawing.type === 'cycleLine') {
    // Cycle Lines: equally spaced vertical lines based on p0→p1 distance
    if (!pts[0] || !pts[1]) return;
    const baseUnit = pts[1].x - pts[0].x;
    if (Math.abs(baseUnit) < 1) return;
    ctx.save();
    ctx.font = '9px monospace';
    ctx.fillStyle = drawing.style.color;
    // Draw cycles extending both directions
    for (let i = 0; i <= 50; i++) {
      const xPos = pts[0].x + i * baseUnit;
      if (xPos < -10 || xPos > canvasWidth + 10) continue;
      ctx.strokeStyle = i === 0 ? '#FFD700' : drawing.style.color;
      ctx.lineWidth = drawing.style.lineWidth;
      applyLineStyle(ctx, drawing.style.lineStyle, drawing.style.lineWidth);
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, canvasHeight);
      ctx.stroke();
      if (i > 0) ctx.fillText(String(i), xPos + 2, 12);
    }
    ctx.restore();

  } else if (drawing.type === 'regressionChannel') {
    // Linear Regression Channel: main regression line + parallel bands
    if (!pts[0] || !pts[1]) return;
    // Simple: use p0→p1 as the regression line, add offset bands
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = -dy / len;
    const ny = dx / len;
    // Band distance = 20% of the line length
    const bandDist = len * 0.15;

    // Main regression line
    const [ms, me] = extendLineFull(pts[0], pts[1], canvasWidth, canvasHeight);
    ctx.beginPath();
    ctx.moveTo(ms.x, ms.y);
    ctx.lineTo(me.x, me.y);
    ctx.stroke();

    // Upper and lower bands
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const sign of [1, -1]) {
      const offset = sign * bandDist;
      const pa = { x: pts[0].x + offset * nx, y: pts[0].y + offset * ny };
      const pb = { x: pts[1].x + offset * nx, y: pts[1].y + offset * ny };
      const [bs, be] = extendLineFull(pa, pb, canvasWidth, canvasHeight);
      ctx.beginPath();
      ctx.moveTo(bs.x, bs.y);
      ctx.lineTo(be.x, be.y);
      ctx.stroke();
    }
    // Fill between bands
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = drawing.style.color;
    const upper0 = { x: pts[0].x + bandDist * nx, y: pts[0].y + bandDist * ny };
    const upper1 = { x: pts[1].x + bandDist * nx, y: pts[1].y + bandDist * ny };
    const lower0 = { x: pts[0].x - bandDist * nx, y: pts[0].y - bandDist * ny };
    const lower1 = { x: pts[1].x - bandDist * nx, y: pts[1].y - bandDist * ny };
    ctx.beginPath();
    ctx.moveTo(upper0.x, upper0.y);
    ctx.lineTo(upper1.x, upper1.y);
    ctx.lineTo(lower1.x, lower1.y);
    ctx.lineTo(lower0.x, lower0.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  } else if (drawing.type === 'measure') {
    // Measurement tool: shows price diff, % change, bar count
    if (!pts[0] || !pts[1]) return;
    const { x: x0, y: y0 } = pts[0];
    const { x: x1, y: y1 } = pts[1];
    // Dashed line connecting the two points
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // Right angle helper lines
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
    // Info label
    const priceDiff = drawing.points[0].price - drawing.points[1].price;
    const pctChange = drawing.points[0].price !== 0
      ? ((priceDiff / drawing.points[0].price) * 100).toFixed(2)
      : '0.00';
    const barCount = Math.round(Math.abs(x1 - x0) / 30); // approximate
    const label = `${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pctChange}%) ${barCount}根`;
    ctx.save();
    ctx.font = '11px monospace';
    const metrics = ctx.measureText(label);
    const lx = (x0 + x1) / 2 - metrics.width / 2;
    const ly = Math.min(y0, y1) - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(lx - 4, ly - 12, metrics.width + 8, 16);
    ctx.fillStyle = priceDiff >= 0 ? '#FF4444' : '#00CC66';
    ctx.fillText(label, lx, ly);
    ctx.restore();

  } else if (drawing.type === 'ellipse') {
    // Ellipse: p0=center, p1=corner of bounding box
    if (!pts[0] || !pts[1]) return;
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;
    const rx = Math.abs(pts[1].x - pts[0].x) / 2;
    const ry = Math.abs(pts[1].y - pts[0].y) / 2;
    if (rx < 1 || ry < 1) return;
    ctx.save();
    ctx.fillStyle = drawing.style.color + '15';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

  } else if (drawing.type === 'triangle') {
    // Triangle: 3 points
    if (!pts[0] || !pts[1] || !pts[2]) return;
    ctx.save();
    ctx.fillStyle = drawing.style.color + '15';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function DrawingCanvas({ chart, series }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const chartRef = useRef(chart);
  chartRef.current = chart;
  const seriesRef = useRef(series);
  seriesRef.current = series;

  const mousePointRef = useRef<DrawingPoint | null>(null);

  const activeTool = useDrawingStore((s) => s.activeTool);
  const activeStyle = useDrawingStore((s) => s.activeStyle);
  const drawings = useDrawingStore((s) => s.drawings);
  const pendingPoints = useDrawingStore((s) => s.pendingPoints);
  const addPendingPoint = useDrawingStore((s) => s.addPendingPoint);
  const commitDrawing = useDrawingStore((s) => s.commitDrawing);
  const clearPending = useDrawingStore((s) => s.clearPending);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const c = chartRef.current;
    const s = seriesRef.current;
    if (!canvas || !c || !s) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.floor(rect.width);
    const cssH = Math.floor(rect.height);
    if (canvas.width !== cssW || canvas.height !== cssH) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      ctx.scale(dpr, dpr);
    }
    ctx.clearRect(0, 0, cssW, cssH);

    const { drawings: currentDrawings, pendingPoints: ppts, activeStyle: astyle, activeTool: aTool } =
      useDrawingStore.getState();

    for (const drawing of currentDrawings) {
      renderDrawing(ctx, drawing, c, s, cssW, cssH);
    }

    // Preview while placing points
    if (ppts.length > 0 && mousePointRef.current) {
      const p0 = toPixel(ppts[0], c, s);
      const pm = toPixel(mousePointRef.current, c, s);
      if (p0 && pm) {
        ctx.strokeStyle = astyle.color;
        ctx.lineWidth = astyle.lineWidth;
        applyLineStyle(ctx, astyle.lineStyle, astyle.lineWidth);
        ctx.globalAlpha = 0.6;

        if (aTool === 'trendline') {
          const [start, end] = extendLineFull(p0, pm, cssW, cssH);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
        } else if (aTool === 'ray') {
          const dx = pm.x - p0.x;
          const dy = pm.y - p0.y;
          const end = extendRay(p0, dx, dy, cssW, cssH);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(end.x, end.y);
        } else if (aTool === 'channel' && ppts.length === 2) {
          // Show parallel line preview
          const p1 = toPixel(ppts[1], c, s);
          if (p1) {
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
              const nx = -dy / len;
              const ny = dx / len;
              const offset = (pm.x - p0.x) * nx + (pm.y - p0.y) * ny;
              const p2a = { x: p0.x + offset * nx, y: p0.y + offset * ny };
              const p2b = { x: p1.x + offset * nx, y: p1.y + offset * ny };
              const [s2, e2] = extendLineFull(p2a, p2b, cssW, cssH);
              ctx.beginPath();
              ctx.moveTo(s2.x, s2.y);
              ctx.lineTo(e2.x, e2.y);
            }
          }
        } else {
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(pm.x, pm.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Mark first point
        ctx.fillStyle = astyle.color;
        ctx.beginPath();
        ctx.arc(p0.x, p0.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  useEffect(() => {
    const c = chart;
    const canvas = canvasRef.current;
    if (!c || !canvas) return;

    const onViewChange = () => redraw();
    c.timeScale().subscribeVisibleLogicalRangeChange(onViewChange);

    const ro = new ResizeObserver(() => {
      canvas.width = 0;
      canvas.height = 0;
      redraw();
    });
    ro.observe(canvas);

    return () => {
      c.timeScale().unsubscribeVisibleLogicalRangeChange(onViewChange);
      ro.disconnect();
    };
  }, [chart, redraw]);

  useEffect(() => {
    redraw();
  }, [drawings, pendingPoints, redraw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!activeTool) return;
      const c = chartRef.current;
      const s = seriesRef.current;
      if (!c || !s) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pt = toPoint(x, y, c, s);
      if (pt) {
        mousePointRef.current = pt;
        if (useDrawingStore.getState().pendingPoints.length > 0) {
          redraw();
        }
      }
    },
    [activeTool, redraw],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!activeTool) return;
      e.preventDefault();
      const c = chartRef.current;
      const s = seriesRef.current;
      if (!c || !s) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pt = toPoint(x, y, c, s);
      if (!pt) return;

      const { pendingPoints: ppts } = useDrawingStore.getState();

      // 1-point tools
      if (
        activeTool === 'horizontal' ||
        activeTool === 'vertical' ||
        activeTool === 'price_line' ||
        activeTool === 'buyMark' ||
        activeTool === 'sellMark' ||
        activeTool === 'flatMark'
      ) {
        commitDrawing({ type: activeTool, points: [pt], style: { ...activeStyle } });
        return;
      }

      // Text: 1 click + prompt
      if (activeTool === 'text') {
        const txt = window.prompt('输入文字:');
        if (txt && txt.trim()) {
          commitDrawing({ type: 'text', points: [pt], style: { ...activeStyle }, text: txt.trim() });
        } else {
          clearPending();
        }
        return;
      }

      // 3-point tools: channel, parallel_line, pitchfork, triangle
      if (activeTool === 'channel' || activeTool === 'parallel_line' || activeTool === 'pitchfork' || activeTool === 'triangle') {
        if (ppts.length < 2) {
          addPendingPoint(pt);
        } else {
          commitDrawing({
            type: activeTool,
            points: [ppts[0], ppts[1], pt],
            style: { ...activeStyle },
          });
          mousePointRef.current = null;
        }
        return;
      }

      // 2-point tools: trendline, ray, segment, rectangle, fibRetracement, gannAngle
      if (ppts.length === 0) {
        addPendingPoint(pt);
      } else {
        commitDrawing({
          type: activeTool,
          points: [ppts[0], pt],
          style: { ...activeStyle },
        });
        mousePointRef.current = null;
      }
    },
    [activeTool, activeStyle, addPendingPoint, commitDrawing, clearPending],
  );

  const handleMouseLeave = useCallback(() => {
    mousePointRef.current = null;
    if (useDrawingStore.getState().pendingPoints.length > 0) {
      redraw();
    }
  }, [redraw]);

  // Escape key cancels active tool / clears pending
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const { activeTool: at, pendingPoints: ppts } = useDrawingStore.getState();
        if (ppts.length > 0) {
          useDrawingStore.getState().clearPending();
        } else if (at) {
          useDrawingStore.getState().setActiveTool(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: activeTool ? 'auto' : 'none',
        cursor: activeTool ? 'crosshair' : 'default',
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}
