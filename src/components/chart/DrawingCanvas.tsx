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
  } else if (drawing.type === 'trendline' || drawing.type === 'segment') {
    if (!pts[0] || !pts[1]) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
  } else if (drawing.type === 'ray') {
    if (!pts[0] || !pts[1]) return;
    // Extend from p0 through p1 to canvas edge
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const scale = Math.max(canvasWidth, canvasHeight) * 4;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[0].x + (dx / len) * scale, pts[0].y + (dy / len) * scale);
    ctx.stroke();
  } else if (drawing.type === 'rectangle') {
    if (!pts[0] || !pts[1]) return;
    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    const w = Math.abs(pts[1].x - pts[0].x);
    const h = Math.abs(pts[1].y - pts[0].y);
    // Semi-transparent fill
    ctx.fillStyle = drawing.style.color + '22';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  } else {
    // Generic multi-point polyline
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (!p) return;
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
}

export function DrawingCanvas({ chart, series }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep mutable refs so callbacks always see current values without re-subscribing
  const chartRef = useRef(chart);
  chartRef.current = chart;
  const seriesRef = useRef(series);
  seriesRef.current = series;

  // Mouse position while drawing (for preview line)
  const mousePointRef = useRef<DrawingPoint | null>(null);

  const activeTool = useDrawingStore((s) => s.activeTool);
  const activeStyle = useDrawingStore((s) => s.activeStyle);
  const drawings = useDrawingStore((s) => s.drawings);
  const pendingPoints = useDrawingStore((s) => s.pendingPoints);
  const addPendingPoint = useDrawingStore((s) => s.addPendingPoint);
  const commitDrawing = useDrawingStore((s) => s.commitDrawing);

  // The main redraw function reads all state from refs/store directly
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const c = chartRef.current;
    const s = seriesRef.current;
    if (!canvas || !c || !s) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Keep canvas pixel dimensions in sync with CSS size
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

    const { drawings: currentDrawings, pendingPoints: ppts, activeStyle: astyle } =
      useDrawingStore.getState();

    // Draw committed drawings
    for (const drawing of currentDrawings) {
      renderDrawing(ctx, drawing, c, s, cssW, cssH);
    }

    // Draw in-progress preview (first pending point → mouse position)
    if (ppts.length > 0 && mousePointRef.current) {
      const p0 = toPixel(ppts[0], c, s);
      const pm = toPixel(mousePointRef.current, c, s);
      if (p0 && pm) {
        ctx.strokeStyle = astyle.color;
        ctx.lineWidth = astyle.lineWidth;
        applyLineStyle(ctx, astyle.lineStyle, astyle.lineWidth);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(pm.x, pm.y);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Mark first point
        ctx.fillStyle = astyle.color;
        ctx.beginPath();
        ctx.arc(p0.x, p0.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []); // empty deps: reads everything from refs / store.getState()

  // Subscribe to chart view changes (scroll/zoom) to trigger redraw
  useEffect(() => {
    const c = chart;
    const canvas = canvasRef.current;
    if (!c || !canvas) return;

    const onViewChange = () => redraw();
    c.timeScale().subscribeVisibleLogicalRangeChange(onViewChange);

    // Also redraw on resize via ResizeObserver
    const ro = new ResizeObserver(() => {
      // Reset canvas dimensions so next redraw picks up new size
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

  // Redraw whenever drawings or pending points change
  useEffect(() => {
    redraw();
  }, [drawings, pendingPoints, redraw]);

  // --- Mouse event handlers ---

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
        // Redraw if there's a pending start point (preview line)
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
      if (activeTool === 'horizontal' || activeTool === 'vertical') {
        commitDrawing({ type: activeTool, points: [pt], style: { ...activeStyle } });
        return;
      }

      // 2-point tools (trendline, ray, segment, rectangle)
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
    [activeTool, activeStyle, addPendingPoint, commitDrawing],
  );

  const handleMouseLeave = useCallback(() => {
    mousePointRef.current = null;
    if (useDrawingStore.getState().pendingPoints.length > 0) {
      redraw();
    }
  }, [redraw]);

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
