import type { OhlcvData } from '@/stores/dataStore';

export type Period =
  | '1m' | '5m' | '15m' | '30m' | '60m'
  | 'daily' | 'weekly' | 'monthly'
  | 'quarterly' | 'yearly' | 'multi_year';

/**
 * Get the grouping key for a candle based on the target period.
 */
function getBucketKey(time: string, period: Period): string {
  const d = new Date(time);

  switch (period) {
    case '1m':
    case '5m':
    case '15m':
    case '30m':
    case '60m': {
      const minutes = parseInt(period, 10);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const hour = d.getHours();
      const minuteBucket = Math.floor(d.getMinutes() / minutes) * minutes;
      return `${year}-${month}-${day}-${hour}-${minuteBucket}`;
    }

    case 'daily':
      return d.toISOString().slice(0, 10);

    case 'weekly': {
      // ISO week: find the Monday of the week
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const dayOfWeek = d.getDay() || 7; // Convert Sunday=0 to 7
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek + 1);
      const weekYear = monday.getFullYear();
      const weekNum = Math.ceil(
        ((monday.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7,
      );
      return `${weekYear}-W${String(weekNum).padStart(2, '0')}`;
    }

    case 'monthly':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    case 'quarterly': {
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      return `${d.getFullYear()}-Q${quarter}`;
    }

    case 'yearly':
      return `${d.getFullYear()}`;

    case 'multi_year': {
      const block = Math.floor(d.getFullYear() / 3) * 3;
      return `${block}-${block + 2}`;
    }

    default:
      return time;
  }
}

/**
 * Aggregate an array of OHLCV candles into a coarser period.
 *
 * - open  = first candle's open
 * - high  = max of all highs
 * - low   = min of all lows
 * - close = last candle's close
 * - volume = sum
 * - amount = sum
 */
export function aggregateCandles(candles: OhlcvData[], targetPeriod: Period): OhlcvData[] {
  if (candles.length === 0) return [];

  const buckets = new Map<string, OhlcvData[]>();

  for (const candle of candles) {
    const key = getBucketKey(candle.time, targetPeriod);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(candle);
    } else {
      buckets.set(key, [candle]);
    }
  }

  const result: OhlcvData[] = [];

  for (const group of buckets.values()) {
    const first = group[0];
    const last = group[group.length - 1];

    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    let amount = 0;

    for (const c of group) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume;
      amount += c.amount ?? 0;
    }

    const aggregated: OhlcvData = {
      time: first.time,
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
    };

    // Only include amount if any candle had it
    if (group.some((c) => c.amount !== undefined)) {
      aggregated.amount = amount;
    }

    result.push(aggregated);
  }

  return result;
}
