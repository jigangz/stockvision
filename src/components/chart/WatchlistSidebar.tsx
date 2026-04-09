import { useEffect, useState } from 'react';
import { useWatchlistStore } from '@/stores/watchlistStore';
import { useQuotesStore } from '@/stores/quotesStore';
import { useChartStore } from '@/stores/chartStore';
import styles from './WatchlistSidebar.module.css';

export function WatchlistSidebar(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const codes = useWatchlistStore((s) => s.codes);
  const fetchWatchlist = useWatchlistStore((s) => s.fetchWatchlist);
  const quotes = useQuotesStore((s) => s.quotes);
  const startPolling = useQuotesStore((s) => s.startPolling);
  const stopPolling = useQuotesStore((s) => s.stopPolling);
  const currentCode = useChartStore((s) => s.currentCode);
  const setCode = useChartStore((s) => s.setCode);
  const setMarket = useChartStore((s) => s.setMarket);

  useEffect(() => {
    void fetchWatchlist();
    startPolling();
    return () => {
      stopPolling();
    };
  }, [fetchWatchlist, startPolling, stopPolling]);

  const handleRowClick = (code: string) => {
    const q = quotes.get(code);
    setCode(code);
    if (q) {
      // Determine market from code prefix (6xxx = SH, others = SZ)
      const market = code.startsWith('6') ? 'SH' : 'SZ';
      setMarket(market as 'SH' | 'SZ');
    }
  };

  return (
    <div className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        {!collapsed && <span className={styles.title}>自选股</span>}
        <button
          className={styles.toggleBtn}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? '展开' : '收起'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>
      {!collapsed && (
        <div className={styles.list}>
          {codes.length === 0 && (
            <div className={styles.empty}>暂无自选股</div>
          )}
          {codes.map((code) => {
            const q = quotes.get(code);
            const isActive = code === currentCode;
            const up = q && q.change_pct >= 0;
            return (
              <div
                key={code}
                className={`${styles.row} ${isActive ? styles.active : ''}`}
                onClick={() => handleRowClick(code)}
              >
                <span className={styles.name}>{q ? q.name : code}</span>
                <span className={`${styles.price} ${up ? styles.up : styles.down}`}>
                  {q ? q.price.toFixed(2) : '--'}
                </span>
                <span className={`${styles.changePct} ${up ? styles.up : styles.down}`}>
                  {q ? `${q.change_pct >= 0 ? '+' : ''}${q.change_pct.toFixed(2)}%` : '--'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
