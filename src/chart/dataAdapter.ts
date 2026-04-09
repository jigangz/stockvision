import type { KLineData } from 'klinecharts';
import type { OhlcvData } from '@/stores/dataStore';

/**
 * Convert our OhlcvData format to KLineChart's KLineData format.
 * OhlcvData.time is "YYYY-MM-DD" string; KLineData.timestamp is milliseconds.
 */
export function toKLineData(candles: OhlcvData[]): KLineData[] {
  return candles.map((c) => ({
    timestamp: new Date(c.time).getTime(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    turnover: c.amount,
  }));
}

/**
 * Convert a single candle for live updates.
 */
export function toSingleKLineData(candle: OhlcvData): KLineData {
  return {
    timestamp: new Date(candle.time).getTime(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    turnover: candle.amount,
  };
}
