import { useEffect } from 'react';
import { useChartStore } from '@/stores/chartStore';
import { useQuotesStore } from '@/stores/quotesStore';
import styles from './StockInfoPanel.module.css';

function safe(v: unknown, digits = 2): string {
  if (v == null || typeof v !== 'number' || isNaN(v)) return '--';
  return v.toFixed(digits);
}

function formatVolume(v: unknown): string {
  if (v == null || typeof v !== 'number' || isNaN(v)) return '--';
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
  return v.toFixed(0);
}

function formatAmount(v: unknown): string {
  if (v == null || typeof v !== 'number' || isNaN(v)) return '--';
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
  return v.toFixed(0);
}

export function StockInfoPanel(): React.ReactElement {
  const currentCode = useChartStore((s) => s.currentCode);
  const quotes = useQuotesStore((s) => s.quotes);
  const fetchAllQuotes = useQuotesStore((s) => s.fetchAllQuotes);

  useEffect(() => {
    if (quotes.size === 0 || !quotes.has(currentCode)) {
      void fetchAllQuotes();
    }
  }, [quotes.size, currentCode, fetchAllQuotes]);

  const q = quotes.get(currentCode);
  const hasQuoteData = q != null && q.price != null;
  const up = hasQuoteData ? q.change_pct >= 0 : false;
  const colorClass = up ? styles.up : styles.down;

  const fields: Array<{ label: string; value: string; colorize?: boolean }> = hasQuoteData
    ? [
        { label: '今开', value: safe(q.open), colorize: true },
        { label: '昨收', value: safe(q.prev_close) },
        { label: '最高', value: safe(q.high), colorize: true },
        { label: '最低', value: safe(q.low), colorize: true },
        { label: '成交量', value: formatVolume(q.volume) },
        { label: '成交额', value: formatAmount(q.amount) },
        { label: '换手率', value: q.turnover_rate != null ? `${safe(q.turnover_rate)}%` : '--' },
        { label: '市盈率', value: q.pe_ratio > 0 ? safe(q.pe_ratio) : '--' },
        { label: '振幅', value: q.amplitude != null ? `${safe(q.amplitude)}%` : '--' },
        { label: '量比', value: safe(q.quantity_ratio) },
      ]
    : [];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.code}>{currentCode}</span>
        <span className={styles.name}>{q ? q.name : '--'}</span>
      </div>
      {hasQuoteData ? (
        <>
          <div className={`${styles.price} ${colorClass}`}>
            {safe(q.price)}
          </div>
          <div className={styles.changeRow}>
            <span className={colorClass}>
              {q.change_amount >= 0 ? '+' : ''}{safe(q.change_amount)}
            </span>
            <span className={`${colorClass} ${styles.changePct}`}>
              {q.change_pct >= 0 ? '+' : ''}{safe(q.change_pct)}%
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
