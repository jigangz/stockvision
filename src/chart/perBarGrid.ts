/**
 * Custom indicator that draws grid lines aligned to K-line bars.
 * - Vertical: one dashed line per bar
 * - Horizontal: dashed lines where each dash/gap spans exactly one bar width,
 *   drawn at the exact same Y positions as Y-axis tick labels
 * Registered once, then applied to candle_pane as an overlay indicator.
 */
import { registerIndicator } from 'klinecharts';
import type { KLineData } from 'klinecharts';
import { tickState } from './customYAxis';

const GRID_COLOR = '#0E1A45';

/**
 * Fallback: compute "nice" tick interval identical to KLineChart's algorithm.
 * Used when tickState.prices is empty (before custom Y-axis runs).
 */
function niceInterval(range: number): number {
  const rawInterval = range / 8;
  if (rawInterval <= 0) return 1;
  const exp = Math.floor(Math.log10(rawInterval));
  const exp10 = Math.pow(10, exp);
  const f = rawInterval / exp10;
  let nf: number;
  if (f < 1.5) nf = 1;
  else if (f < 2.5) nf = 2;
  else if (f < 3.5) nf = 3;
  else if (f < 4.5) nf = 4;
  else if (f < 5.5) nf = 5;
  else if (f < 6.5) nf = 6;
  else nf = 8;
  return nf * exp10;
}

registerIndicator({
  name: 'PER_BAR_GRID',
  shortName: '',
  figures: [],
  calc: (dataList: KLineData[]) => dataList.map(() => ({})),
  draw: ({ ctx, visibleRange, bounding, xAxis, yAxis }) => {
    ctx.save();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    // Calculate bar width from two adjacent visible bars
    let barWidth = 8; // fallback
    if (visibleRange.to - visibleRange.from >= 2) {
      const x0 = xAxis.convertToPixel(visibleRange.from);
      const x1 = xAxis.convertToPixel(visibleRange.from + 1);
      barWidth = Math.abs(x1 - x0);
    }

    // --- Vertical grid: one dashed line per bar ---
    ctx.setLineDash([2, 3]);
    for (let i = visibleRange.from; i < visibleRange.to; i++) {
      const x = xAxis.convertToPixel(i);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, bounding.height);
      ctx.stroke();
    }

    // --- Horizontal grid: dash = barWidth, gap = barWidth ---
    // Use tick prices from custom Y-axis if available, otherwise compute fallback
    let prices = tickState.prices;
    if (prices.length === 0) {
      // Fallback: compute our own ticks
      const priceTop = yAxis.convertFromPixel(0);
      const priceBottom = yAxis.convertFromPixel(bounding.height);
      const priceMin = Math.min(priceTop, priceBottom);
      const priceMax = Math.max(priceTop, priceBottom);
      const range = priceMax - priceMin;
      if (range > 0) {
        const interval = niceInterval(range);
        const firstTick = Math.ceil(priceMin / interval) * interval;
        prices = [];
        for (let p = firstTick; p <= priceMax; p += interval) {
          prices.push(Math.round(p * 1e8) / 1e8);
        }
      }
    }

    if (prices.length > 0) {
      ctx.setLineDash([barWidth, barWidth]);
      for (const price of prices) {
        const y = yAxis.convertToPixel(price);
        if (y <= 0 || y >= bounding.height) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(bounding.width, y);
        ctx.stroke();
      }
    }

    ctx.restore();
    return false;
  },
});
