import { useEffect, type MutableRefObject } from 'react';
import type { IChartApi, LogicalRange, MouseEventParams } from 'lightweight-charts';

/**
 * Syncs timeScale visible range and crosshair position across multiple
 * Lightweight Charts instances. Uses a syncing flag to prevent infinite loops.
 */
export function useChartSync(
  chartRefs: MutableRefObject<IChartApi | null>[]
): void {
  useEffect(() => {
    const charts = chartRefs
      .map((ref) => ref.current)
      .filter((c): c is IChartApi => c !== null);

    if (charts.length < 2) return;

    let isSyncing = false;

    // --- Visible range sync ---
    const rangeHandlers: Array<() => void> = [];

    for (const source of charts) {
      const handler = (range: LogicalRange | null): void => {
        if (isSyncing || range === null) return;
        isSyncing = true;
        for (const target of charts) {
          if (target !== source) {
            target.timeScale().setVisibleLogicalRange(range);
          }
        }
        isSyncing = false;
      };

      source.timeScale().subscribeVisibleLogicalRangeChange(handler);
      rangeHandlers.push(() => {
        source.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
      });
    }

    // --- Crosshair sync ---
    const crosshairHandlers: Array<() => void> = [];

    for (const source of charts) {
      const handler = (param: MouseEventParams): void => {
        if (isSyncing) return;
        isSyncing = true;

        for (const target of charts) {
          if (target === source) continue;

          if (param.time !== undefined) {
            target.setCrosshairPosition(
              NaN, // price — NaN means "don't snap to a series"
              undefined as never, // series — not needed for time-only sync
              param.time
            );
          } else {
            target.clearCrosshairPosition();
          }
        }

        isSyncing = false;
      };

      source.subscribeCrosshairMove(handler);
      crosshairHandlers.push(() => {
        source.unsubscribeCrosshairMove(handler);
      });
    }

    return () => {
      for (const unsub of rangeHandlers) unsub();
      for (const unsub of crosshairHandlers) unsub();
    };
  }, [chartRefs]);
}
