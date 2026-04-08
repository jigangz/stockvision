import React from 'react';
import { useCrosshairStore } from '@/stores/crosshairStore';
import styles from './Crosshair.module.css';

interface CrosshairProps {
  chartArea: 'kline' | 'volume' | 'indicator';
}

export const Crosshair: React.FC<CrosshairProps> = ({ chartArea }) => {
  const { snapX, mouseY, priceAtY, timeLabel, activeChart } =
    useCrosshairStore();

  if (snapX === null) return null;

  const showHorizontal = activeChart === chartArea;

  return (
    <div className={styles.crosshairOverlay}>
      {/* Vertical line -- always visible, spans full height */}
      <div
        className={styles.verticalLine}
        style={{ left: snapX }}
      />

      {/* Horizontal line -- only in active chart area */}
      {showHorizontal && mouseY !== null && (
        <>
          <div
            className={styles.horizontalLine}
            style={{ top: mouseY }}
          />
          {/* Y-axis price label */}
          {priceAtY !== null && chartArea === 'kline' && (
            <div
              className={styles.priceLabel}
              style={{ top: mouseY - 10, right: 0 }}
            >
              {priceAtY.toFixed(2)}
            </div>
          )}
        </>
      )}

      {/* X-axis time label -- only at bottom of indicator chart */}
      {chartArea === 'indicator' && timeLabel && (
        <div className={styles.timeLabel} style={{ left: snapX - 50 }}>
          {timeLabel}
        </div>
      )}
    </div>
  );
};
