import { useEffect, useRef } from 'react';
import { LineType } from 'klinecharts';
import type { Chart } from 'klinecharts';
import { useDrawingStore, type Drawing } from '@/stores/drawingStore';
import { getOverlayName } from '@/chart/overlayMapping';

interface DrawingBridgeProps {
  chart: Chart | null;
}

/**
 * Bridge between drawingStore and KLineChart overlays.
 * Watches drawingStore.drawings and syncs to chart overlays.
 * Renders nothing — this is a side-effect-only component.
 */
export function DrawingBridge({ chart }: DrawingBridgeProps): null {
  const drawings = useDrawingStore((s) => s.drawings);
  const activeTool = useDrawingStore((s) => s.activeTool);
  const prevDrawingIdsRef = useRef<Set<string>>(new Set());

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
  useEffect(() => {
    if (!chart || !activeTool) return;

    const overlayName = getOverlayName(activeTool);
    chart.createOverlay({
      name: overlayName,
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
        return true;
      },
    });
  }, [activeTool, chart]);

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
