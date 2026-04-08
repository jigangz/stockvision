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

const GANN_ANGLES = [
  { rY: 2, rX: 1, label: '1×2' },
  { rY: 1, rX: 1, label: '1×1' },
  { rY: 1, rX: 2, label: '2×1' },
];

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

      // 3-point tool: channel
      if (activeTool === 'channel') {
        if (ppts.length < 2) {
          addPendingPoint(pt);
        } else {
          commitDrawing({
            type: 'channel',
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
