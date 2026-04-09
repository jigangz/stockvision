import { useEffect } from 'react';
import { useChartStore } from '@/stores/chartStore';
import { useQuotesStore } from '@/stores/quotesStore';
import styles from './StockInfoPanel.module.css';

function formatVolume(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
  return v.toFixed(0);
}

function formatAmount(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
  return v.toFixed(0);
}

export function StockInfoPanel(): React.ReactElement {
  const currentCode = useChartStore((s) => s.currentCode);
  const quotes = useQuotesStore((s) => s.quotes);
  const fetchAllQuotes = useQuotesStore((s) => s.fetchAllQuotes);

  useEffect(() => {
    if (quotes.size === 0) {
      void fetchAllQuotes();
    }
  }, [quotes.size, fetchAllQuotes]);

  const q = quotes.get(currentCode);
  const up = q ? q.change_pct >= 0 : false;
  const colorClass = up ? styles.up : styles.down;

  const fields: Array<{ label: string; value: string; colorize?: boolean }> = q
    ? [
        { label: '今开', value: q.open.toFixed(2), colorize: true },
        { label: '昨收', value: q.prev_close.toFixed(2) },
        { label: '最高', value: q.high.toFixed(2), colorize: true },
        { label: '最低', value: q.low.toFixed(2), colorize: true },
        { label: '成交量', value: formatVolume(q.volume) },
        { label: '成交额', value: formatAmount(q.amount) },
        { label: '换手率', value: `${q.turnover_rate.toFixed(2)}%` },
        { label: '市盈率', value: q.pe_ratio > 0 ? q.pe_ratio.toFixed(2) : '--' },
        { label: '振幅', value: `${q.amplitude.toFixed(2)}%` },
        { label: '量比', value: q.quantity_ratio.toFixed(2) },
      ]
    : [];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.code}>{currentCode}</span>
        <span className={styles.name}>{q ? q.name : '--'}</span>
      </div>
      {q ? (
        <>
          <div className={`${styles.price} ${colorClass}`}>
            {q.price.toFixed(2)}
          </div>
          <div className={styles.changeRow}>
            <span className={colorClass}>
              {q.change_amount >= 0 ? '+' : ''}{q.change_amount.toFixed(2)}
            </span>
            <span className={`${colorClass} ${styles.changePct}`}>
              {q.change_pct >= 0 ? '+' : ''}{q.change_pct.toFixed(2)}%
            </span>
          </div>
          <div className={styles.grid}>
            {fields.map(({ label, value, colorize }) => (
              <div key={label} className={styles.gridItem}>
                <span className={styles.fieldLabel}>{label}</span>
                <span className={`${styles.fieldValue} ${colorize ? colorClass : ''}`}>{value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.noData}>暂无行情数据</div>
      )}
    </div>
  );
}
