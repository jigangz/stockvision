import React, { useState, useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import styles from './InfoPanel.module.css';

const SECTORS = [
  '上证指数', '深证成指', '创业板指', '科创50',
  '半导体', '新能源', '医药', '消费',
  '银行', '房地产', '军工', '人工智能',
];

export const InfoPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const candles = useDataStore((s) => s.candles);
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);

  const summary = useMemo(() => {
    if (candles.length === 0) return null;
    const last = candles[candles.length - 1];
    const prevClose =
      candles.length >= 2 ? candles[candles.length - 2].close : last.open;
    const change = last.close - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
    return { last, prevClose, change, changePercent };
  }, [candles]);

  // Use last 30 candles as tick-like list (newest first)
  const ticks = useMemo(() => {
    const slice = candles.slice(-30).reverse();
    return slice.map((bar, i) => {
      const prevClose =
        i < slice.length - 1 ? slice[i + 1].close : bar.open;
      return { ...bar, direction: bar.close >= prevClose ? 'up' : 'down' };
    });
  }, [candles]);

  return (
    <div className={styles.panel}>
      {/* Header with collapse toggle */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          {currentCode} · {currentMarket}
        </span>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? '展开' : '收起'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Market Summary */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>行情概要</div>
            {summary ? (
              <div className={styles.summaryGrid}>
                <SummaryRow
                  label="最新价"
                  value={summary.last.close.toFixed(2)}
                  colorClass={
                    summary.change > 0
                      ? styles.up
                      : summary.change < 0
                      ? styles.down
                      : styles.flat
                  }
                />
                <SummaryRow
                  label="开盘价"
                  value={summary.last.open.toFixed(2)}
                  colorClass={styles.neutral}
                />
                <SummaryRow
                  label="昨收价"
                  value={summary.prevClose.toFixed(2)}
                  colorClass={styles.neutral}
                />
                <SummaryRow
                  label="涨跌幅"
                  value={`${summary.changePercent >= 0 ? '+' : ''}${summary.changePercent.toFixed(2)}%`}
                  colorClass={
                    summary.change > 0
                      ? styles.up
                      : summary.change < 0
                      ? styles.down
                      : styles.flat
                  }
                />
                <SummaryRow
                  label="成交量"
                  value={formatVolume(summary.last.volume)}
                  colorClass={styles.neutral}
                />
                <SummaryRow
                  label="成交额"
                  value={formatAmount(summary.last.amount ?? 0)}
                  colorClass={styles.neutral}
                />
                <SummaryRow
                  label="最高价"
                  value={summary.last.high.toFixed(2)}
                  colorClass={styles.up}
                />
                <SummaryRow
                  label="最低价"
                  value={summary.last.low.toFixed(2)}
                  colorClass={styles.down}
                />
              </div>
            ) : (
              <div className={styles.noData}>暂无数据</div>
            )}
          </div>

          {/* Tick List */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>分时明细</div>
            <div className={styles.tickHeader}>
              <span>时间</span>
              <span>价格</span>
              <span>成交量</span>
            </div>
            <div className={styles.tickList}>
              {ticks.length === 0 ? (
                <div className={styles.noData}>暂无数据</div>
              ) : (
                ticks.map((tick, i) => (
                  <div
                    key={i}
                    className={`${styles.tickRow} ${
                      tick.direction === 'up' ? styles.up : styles.down
                    }`}
                  >
                    <span>{formatTickTime(tick.time)}</span>
                    <span>{tick.close.toFixed(2)}</span>
                    <span>{formatVolume(tick.volume)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sector Quick Links */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>板块快链</div>
            <div className={styles.sectorGrid}>
              {SECTORS.map((sector) => (
                <button key={sector} className={styles.sectorBtn}>
                  {sector}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SummaryRow: React.FC<{
  label: string;
  value: string;
  colorClass: string;
}> = ({ label, value, colorClass }) => (
  <div className={styles.summaryRow}>
    <span className={styles.summaryLabel}>{label}</span>
    <span className={colorClass}>{value}</span>
  </div>
);

function formatVolume(vol: number): string {
  if (vol >= 100000000) return `${(vol / 100000000).toFixed(1)}亿`;
  if (vol >= 10000) return `${(vol / 10000).toFixed(1)}万`;
  return `${vol}`;
}

function formatAmount(amt: number): string {
  if (amt >= 100000000) return `${(amt / 100000000).toFixed(2)}亿`;
  if (amt >= 10000) return `${(amt / 10000).toFixed(2)}万`;
  return `${amt.toFixed(0)}`;
}

function formatTickTime(timeStr: string): string {
  // timeStr is "YYYY-MM-DD" format
  const parts = timeStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return timeStr.slice(5); // fallback: MM-DD
}
