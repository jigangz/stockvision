import { useEffect, useRef, useState } from 'react';
import { LineType, OverlayMode } from 'klinecharts';
import type { Chart } from 'klinecharts';
import { useDrawingStore, type Drawing } from '@/stores/drawingStore';
import { getOverlayName } from '@/chart/overlayMapping';
import { findSnapTarget } from '@/chart/overlaySnap';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';

interface DrawingBridgeProps {
  chart: Chart | null;
}

/**
 * Bridge between drawingStore and KLineChart overlays.
 * Watches drawingStore.drawings and syncs to chart overlays.
 * Renders nothing — this is a side-effect-only component.
 *
 * Modifier keys during drawing:
 *   Shift — constrain to horizontal/vertical straight line
 *   Ctrl  — snap to K-line OHLC prices (StrongMagnet)
 */
export function DrawingBridge({ chart }: DrawingBridgeProps): null {
  const drawings = useDrawingStore((s) => s.drawings);
  const activeTool = useDrawingStore((s) => s.activeTool);
  const prevDrawingIdsRef = useRef<Set<string>>(new Set());
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [drawSeq, setDrawSeq] = useState(0);

  // Track Ctrl key for K-line magnet mode
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Control') setCtrlHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Control') setCtrlHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Sync existing drawings to chart overlays
  useEffect(() => {
    if (!chart) return;

    const currentIds = new Set(drawings.map((d) => d.id));
    const prevIds = prevDrawingIdsRef.current;

    // Remove overlays that no longer exist in store
    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        chart.removeOverlay({ id });
      }
    }

    // Add overlays for new drawings
    for (const drawing of drawings) {
      if (!prevIds.has(drawing.id)) {
        createChartOverlay(chart, drawing);
      }
    }

    prevDrawingIdsRef.current = currentIds;
  }, [drawings, chart]);

  // Handle active drawing tool — enable overlay creation mode
  // Ctrl = StrongMagnet (snap to K-line OHLC)
  // Shift = constrain to horizontal/vertical (handled in performEventMoveForDrawing)
  useEffect(() => {
    if (!chart || !activeTool) return;

    const overlayName = getOverlayName(activeTool);

    // Estimate bar interval and price range for snap calculations
    const dataList = chart.getDataList();
    let barInterval = 86400; // default 1 day in seconds
    if (dataList.length >= 2) {
      barInterval = (dataList[dataList.length - 1].timestamp - dataList[dataList.length - 2].timestamp) / 1000;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overlayId = (chart as any).createOverlay({
      name: overlayName,
      mode: ctrlHeld ? OverlayMode.StrongMagnet : OverlayMode.Normal,
      modeSensitivity: 8,
      performEventMoveForDrawing: (params: {
        points: Array<{ timestamp?: number; value?: number }>;
        performPointIndex: number;
        performPoint: { timestamp?: number; value?: number };
      }): void => {
        const pt = params.performPoint;

        // Shift: constrain to horizontal or vertical from first point
        // Only applies when placing 2nd+ point (index > 0)
        if (params.performPointIndex > 0 && params.points.length > 0) {
          // Check Shift synchronously via DOM state (useState is stale in callback)
          const shiftDown = !!(window as any).__shiftHeld;
          if (shiftDown) {
            const firstPoint = params.points[0];
            if (firstPoint.timestamp != null && firstPoint.value != null && pt.timestamp != null && pt.value != null) {
              const dTime = Math.abs(pt.timestamp - firstPoint.timestamp);
              const dPrice = Math.abs(pt.value - firstPoint.value);
              // Use price range to normalize comparison
              let pricePerMs = 1;
              if (dataList.length > 0) {
                let minP = Infinity, maxP = -Infinity;
                for (let i = Math.max(0, dataList.length - 50); i < dataList.length; i++) {
                  if (dataList[i].high > maxP) maxP = dataList[i].high;
                  if (dataList[i].low < minP) minP = dataList[i].low;
                }
                const visibleBars = 50;
                const visibleTimeMs = barInterval * 1000 * visibleBars;
                pricePerMs = (maxP - minP) / visibleTimeMs || 1;
              }
              // Compare normalized distances to decide horizontal vs vertical
              const normalizedTime = dTime * pricePerMs;
              if (normalizedTime > dPrice) {
                // More horizontal movement → lock price (horizontal line)
                pt.value = firstPoint.value;
              } else {
                // More vertical movement → lock time (vertical line)
                pt.timestamp = firstPoint.timestamp;
              }
              return; // skip overlay snap when shift-constraining
            }
          }
        }

        // Default: snap to existing overlay lines/points/intersections
        const currentDrawings = useDrawingStore.getState().drawings;

        const cursorTime = (pt.timestamp ?? 0) / 1000;
        const cursorPrice = pt.value ?? 0;

        let priceRange = 10;
        if (dataList.length > 0) {
          let minP = Infinity, maxP = -Infinity;
          for (let i = Math.max(0, dataList.length - 100); i < dataList.length; i++) {
            if (dataList[i].high > maxP) maxP = dataList[i].high;
            if (dataList[i].low < minP) minP = dataList[i].low;
          }
          priceRange = maxP - minP || 10;
        }

        // Collect manual price range min/max as extra snap targets
        const { priceScaleMode, priceMin, priceMax } = useChartSettingsStore.getState();
        const extraH: number[] = [];
        if (priceScaleMode === 'manual') {
          if (priceMin != null) extraH.push(priceMin);
          if (priceMax != null) extraH.push(priceMax);
        }

        if (currentDrawings.length === 0 && extraH.length === 0) return;

        const snap = findSnapTarget(currentDrawings, cursorTime, cursorPrice, priceRange, barInterval, extraH);
        if (snap) {
          if (snap.timestamp != null) pt.timestamp = snap.timestamp;
          if (snap.value != null) pt.value = snap.value;
        }
      },
      onDrawEnd: (event: { overlay: { points: Array<{ timestamp?: number; value?: number }> } }): boolean => {
        const overlay = event.overlay;
        const points = overlay.points.map((p) => ({
          time: Math.floor((p.timestamp ?? 0) / 1000),
          price: p.value ?? 0,
        }));
        const store = useDrawingStore.getState();
        store.commitDrawing({
          type: activeTool,
          points,
          style: store.activeStyle,
        });
        // Explicitly remove the temporary overlay after KLineChart finishes
        // its internal callback processing (return false alone is unreliable in v9)
        const tempId = overlayId;
        if (tempId) {
          queueMicrotask(() => chart.removeOverlay({ id: tempId }));
        }
        // Bump drawSeq to re-run the effect → create a new temp overlay
        // so user can draw another line without re-selecting the tool
        queueMicrotask(() => setDrawSeq((n) => n + 1));
        return false;
      },
    });

    return () => {
      if (overlayId) chart.removeOverlay({ id: overlayId });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, chart, ctrlHeld, drawSeq]);

  // Track Shift key globally via window property (accessible in callbacks)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') (window as any).__shiftHeld = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') (window as any).__shiftHeld = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      (window as any).__shiftHeld = false;
    };
  }, []);

  return null;
}

function createChartOverlay(chart: Chart, drawing: Drawing): void {
  const overlayName = getOverlayName(drawing.type);
  const points = drawing.points.map((p) => ({
    timestamp: p.time * 1000, // store uses seconds, KLineChart uses ms
    value: p.price,
  }));

  chart.createOverlay({
    id: drawing.id,
    name: overlayName,
    points,
    lock: drawing.locked ?? false,
    visible: true,
    styles: {
      line: {
        color: drawing.style.color,
        size: drawing.style.lineWidth,
        style: drawing.style.lineStyle === 'dashed' ? LineType.Dashed : LineType.Solid,
      },
    },
    onRightClick: (): boolean => {
      useDrawingStore.getState().selectDrawing(drawing.id);
      return false;
    },
    onSelected: (): boolean => {
      useDrawingStore.getState().selectDrawing(drawing.id);
      return true;
    },
    onDeselected: (): boolean => {
      const store = useDrawingStore.getState();
      if (store.selectedId === drawing.id) {
        store.selectDrawing(null);
      }
      return true;
    },
  });
}
