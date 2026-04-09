import { useEffect, useCallback } from 'react';
import type { IChartApi, ISeriesApi, SeriesType, MouseEventParams } from 'lightweight-charts';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useDataStore } from '@/stores/dataStore';

interface ChartEntry {
  key: 'kline' | 'volume' | 'indicator';
  chart: IChartApi | null;
  /** A series on this chart, used for setCrosshairPosition */
  series: ISeriesApi<SeriesType> | null;
}

export function useCrosshairSync(entries: ChartEntry[]) {
  const setPosition = useCrosshairStore((s) => s.setPosition);
  const clear = useCrosshairStore((s) => s.clear);

  const handleCrosshairMove = useCallback(
    (source: ChartEntry) => (param: MouseEventParams) => {
      if (!param.time || !param.point) {
        clear();
        return;
      }

      const chart = source.chart;
      if (!chart) return;

      const ts = chart.timeScale();
      const snapX = ts.timeToCoordinate(param.time);
      if (snapX === null) return;

      // Find bar index by matching time
      const candles = useDataStore.getState().candles;
      const timeStr = String(param.time);
      const barIndex = candles.findIndex((c) => c.time === timeStr);

      // Get price at Y for the kline chart
      let priceAtY: number | null = null;
      if (source.key === 'kline' && source.series) {
        const coordinate = param.point.y;
        const priceSeries = source.series;
        priceAtY = priceSeries.coordinateToPrice(coordinate);
      }

      setPosition({
        snapX,
        mouseY: param.point.y,
        timeLabel: formatTime(param.time as number),
        activeChart: source.key,
        activeBarIndex: barIndex >= 0 ? barIndex : null,
        priceAtY,
        isKeyboardNavMode: false,
      });

      // Sync crosshair to other charts
      for (const entry of entries) {
        if (entry.key !== source.key && entry.chart && entry.series) {
          try {
            entry.chart.setCrosshairPosition(
              NaN, // price — NaN means only show vertical line
              param.time,
              entry.series,
            );
          } catch {
            // setCrosshairPosition may throw if series has no data at this time
          }
        }
      }
    },
    [entries, setPosition, clear],
  );

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    for (const entry of entries) {
      if (entry.chart) {
        const handler = handleCrosshairMove(entry);
        entry.chart.subscribeCrosshairMove(handler);
        unsubs.push(() => entry.chart!.unsubscribeCrosshairMove(handler));
      }
    }
    return () => unsubs.forEach((fn) => fn());
  }, [entries, handleCrosshairMove]);

  // Clear crosshair on all charts when mouse leaves
  const handleMouseLeave = useCallback(() => {
    clear();
    for (const entry of entries) {
      if (entry.chart) {
        try {
          entry.chart.clearCrosshairPosition();
        } catch {
          // ignore
        }
      }
    }
  }, [entries, clear]);

  return { handleMouseLeave };
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const w = weekdays[d.getDay()];
  return `${y}/${m}/${day}/星期${w}`;
}
