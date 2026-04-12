/**
 * Overlay snap system: snaps drawing points to nearby existing overlay lines.
 * Checks horizontal lines (same price), vertical lines (same time),
 * and intersections of two overlay lines.
 */
import type { Drawing } from '@/stores/drawingStore';

const SNAP_THRESHOLD_PRICE_RATIO = 0.02; // 2% of visible price range
const SNAP_THRESHOLD_TIME_BARS = 3; // snap within 3 bars

interface SnapTarget {
  timestamp?: number;
  value?: number;
}

/**
 * Given a cursor point (timestamp, price), find the nearest snap target
 * from existing drawings. Returns modified point or null if no snap.
 */
export function findSnapTarget(
  drawings: Drawing[],
  cursorTimestamp: number,
  cursorPrice: number,
  priceRange: number, // visible price range for threshold calculation
  barInterval: number, // seconds per bar for time threshold
  extraHPrices?: number[], // additional horizontal price levels (e.g. manual min/max)
): SnapTarget | null {
  const priceThreshold = priceRange * SNAP_THRESHOLD_PRICE_RATIO;
  const timeThreshold = barInterval * SNAP_THRESHOLD_TIME_BARS;

  let bestDist = Infinity;
  let bestSnap: SnapTarget | null = null;

  // Collect all snap-able values from drawings
  const hPrices: number[] = []; // horizontal line prices
  const vTimes: number[] = []; // vertical line times
  const points: Array<{ time: number; price: number }> = []; // all points

  for (const d of drawings) {
    for (const p of d.points) {
      points.push(p);
    }

    // Horizontal lines have all points at same price
    if (d.type === 'horizontal' || d.type === 'price_line') {
      if (d.points.length > 0) hPrices.push(d.points[0].price);
    }

    // Vertical lines have all points at same time
    if (d.type === 'vertical') {
      if (d.points.length > 0) vTimes.push(d.points[0].time);
    }
  }

  // Add extra horizontal price levels (manual min/max lines, etc.)
  if (extraHPrices) {
    for (const p of extraHPrices) hPrices.push(p);
  }

  // Check snap to horizontal line prices
  for (const price of hPrices) {
    const dist = Math.abs(cursorPrice - price);
    if (dist < priceThreshold && dist < bestDist) {
      bestDist = dist;
      bestSnap = { value: price };
    }
  }

  // Check snap to vertical line times
  for (const time of vTimes) {
    const dist = Math.abs(cursorTimestamp - time);
    if (dist < timeThreshold && dist < bestDist * (barInterval / priceThreshold)) {
      bestSnap = bestSnap
        ? { ...bestSnap, timestamp: time * 1000 } // merge with price snap = intersection!
        : { timestamp: time * 1000 };
    }
  }

  // Check snap to existing drawing points (exact point snap)
  for (const p of points) {
    const priceDist = Math.abs(cursorPrice - p.price) / priceThreshold;
    const timeDist = Math.abs(cursorTimestamp - p.time) / (timeThreshold || 1);
    const dist = Math.sqrt(priceDist * priceDist + timeDist * timeDist);
    if (dist < 1.5 && dist < bestDist) {
      bestDist = dist;
      bestSnap = { timestamp: p.time * 1000, value: p.price };
    }
  }

  // Check intersections of horizontal and vertical lines
  for (const price of hPrices) {
    for (const time of vTimes) {
      const priceDist = Math.abs(cursorPrice - price) / priceThreshold;
      const timeDist = Math.abs(cursorTimestamp - time) / (timeThreshold || 1);
      const dist = Math.sqrt(priceDist * priceDist + timeDist * timeDist);
      if (dist < 2 && dist < bestDist) {
        bestDist = dist;
        bestSnap = { timestamp: time * 1000, value: price };
      }
    }
  }

  return bestSnap;
}
