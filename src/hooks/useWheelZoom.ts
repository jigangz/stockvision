import { useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';

interface WheelZoomOptions {
  charts: (IChartApi | null)[];
  minBars?: number;
  maxBars?: number;
}

/**
 * Syncs visible time range across all charts when the primary (first) chart
 * is zoomed via mouse wheel. Lightweight Charts handles the actual zoom
 * natively via handleScale.mouseWheel chart option.
 */
export function useWheelZoom({
  charts,
  minBars = 20,
  maxBars = 500,
}: WheelZoomOptions) {
  useEffect(() => {
    const primary = charts[0];
    if (!primary) return;

    let syncing = false;

    const syncHandler = () => {
      if (syncing) return;
      const ts = primary.timeScale();
      const range = ts.getVisibleLogicalRange();
      if (!range) return;

      // Clamp bar count
      const barCount = range.to - range.from;
      if (barCount < minBars || barCount > maxBars) return;

      syncing = true;
      for (let i = 1; i < charts.length; i++) {
        const c = charts[i];
        if (c) {
          c.timeScale().setVisibleLogicalRange(range);
        }
      }
      syncing = false;
    };

    primary.timeScale().subscribeVisibleLogicalRangeChange(syncHandler);
    return () => {
      primary.timeScale().unsubscribeVisibleLogicalRangeChange(syncHandler);
    };
  }, [charts, minBars, maxBars]);
}
