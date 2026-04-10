/**
 * Custom Y-axis that injects manual priceMin/priceMax as extra tick labels
 * when they don't already appear in the default ticks.
 * Also stores the last computed ticks for PER_BAR_GRID to draw horizontal lines.
 */
import { registerYAxis } from 'klinecharts';

/** Global state — set by KLineChartWrapper before adjusting viewport */
export const manualPriceRange = {
  enabled: false,
  min: 0,
  max: 0,
};

/** Shared tick prices — updated every time createTicks runs, read by PER_BAR_GRID */
export const tickState = {
  prices: [] as number[],
};

registerYAxis({
  name: 'manualRangeYAxis',
  createTicks: ({ defaultTicks, range, bounding }) => {
    const ticks = [...defaultTicks];

    if (manualPriceRange.enabled) {
      const { min, max } = manualPriceRange;
      const tolerance = 0.001;

      const hasMin = ticks.some((t) => Math.abs(Number(t.value) - min) < tolerance);
      const hasMax = ticks.some((t) => Math.abs(Number(t.value) - max) < tolerance);

      const calcCoord = (price: number) => {
        if (range.range === 0) return 0;
        return bounding.height * (1 - (price - range.from) / range.range);
      };

      if (!hasMin) {
        ticks.push({
          coord: calcCoord(min),
          value: min,
          text: min.toFixed(2),
        });
      }
      if (!hasMax) {
        ticks.push({
          coord: calcCoord(max),
          value: max,
          text: max.toFixed(2),
        });
      }

      ticks.sort((a, b) => Number(b.value) - Number(a.value));
    }

    // Store tick prices for PER_BAR_GRID horizontal lines
    tickState.prices = ticks.map((t) => Number(t.value));

    return ticks;
  },
});
