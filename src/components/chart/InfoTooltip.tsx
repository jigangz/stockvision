import React, { useMemo } from 'react';
import { useCrosshairStore } from '@/stores/crosshairStore';
import { useChartStore } from '@/stores/chartStore';
import { useDataStore } from '@/stores/dataStore';
import type { TooltipData } from '@/types/tooltip';
import styles from './InfoTooltip.module.css';

export const InfoTooltip: React.FC = () => {
  const activeBarIndex = useCrosshairStore((s) => s.activeBarIndex);
  const currentCode = useChartStore((s) => s.currentCode);
  const candles = useDataStore((s) => s.candles);

  const data: TooltipData | null = useMemo(() => {
    if (activeBarIndex === null || !candles[activeBarIndex]) return null;
    const bar = candles[activeBarIndex];
    const prevClose =
      activeBarIndex > 0 ? candles[activeBarIndex - 1].close : bar.open;
    const change = bar.close - prevClose;
    const changePercent =
      prevClose !== 0 ? (change / prevClose) * 100 : 0;
    const amplitude =
      prevClose !== 0 ? ((bar.high - bar.low) / prevClose) * 100 : 0;

    return {
      symbol: currentCode,
      time: formatTime(bar.time),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      change,
      changePercent,
      volume: bar.volume,
      amount: bar.amount ?? 0,
      turnover: 0,
      amplitude,
    };
  }, [activeBarIndex, candles, currentCode]);

  if (!data) return null;

  const colorClass =
    data.change > 0 ? styles.up : data.change < 0 ? styles.down : styles.flat;

  return (
    <div className={styles.tooltip}>
      <div className={styles.header}>
        <span className={styles.symbol}>{data.symbol}</span>
        <span className={styles.time}>{data.time}</span>
      </div>
      <div className={styles.grid}>
        <Row label="开" value={data.open.toFixed(2)} className={colorClass} />
        <Row label="高" value={data.high.toFixed(2)} className={colorClass} />
        <Row label="低" value={data.low.toFixed(2)} className={colorClass} />
        <Row label="收" value={data.close.toFixed(2)} className={colorClass} />
        <Row
          label="涨跌"
          value={`${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}`}
          className={colorClass}
        />
        <Row
          label="涨幅"
          value={`${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%`}
          className={colorClass}
        />
        <Row
          label="成交量"
          value={formatVolume(data.volume)}
          className={styles.neutral}
        />
        <Row
          label="成交额"
          value={formatAmount(data.amount)}
          className={styles.neutral}
        />
        <Row
          label="振幅"
          value={`${data.amplitude.toFixed(2)}%`}
          className={styles.neutral}
        />
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; className: string }> = ({
  label,
  value,
  className,
}) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <span className={className}>{value}</span>
  </div>
);

function formatTime(timeStr: string): string {
  // timeStr is "YYYY-MM-DD" format from OhlcvData
  const d = new Date(timeStr);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const w = weekdays[d.getDay()];
  return `${y}/${m}/${day}/星期${w}`;
}

function formatVolume(vol: number): string {
  if (vol >= 100000000) return `${(vol / 100000000).toFixed(2)}亿手`;
  if (vol >= 10000) return `${(vol / 10000).toFixed(2)}万手`;
  return `${vol}手`;
}

function formatAmount(amt: number): string {
  if (amt >= 100000000) return `${(amt / 100000000).toFixed(2)}亿`;
  if (amt >= 10000) return `${(amt / 10000).toFixed(2)}万`;
  return `${amt.toFixed(0)}元`;
}
