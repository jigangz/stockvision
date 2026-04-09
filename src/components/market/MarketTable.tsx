import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuotesStore, type QuoteData } from '../../stores/quotesStore';
import { useWatchlistStore } from '../../stores/watchlistStore';
import { useChartStore } from '../../stores/chartStore';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 32;
const OVERSCAN = 5;

type SortKey = keyof QuoteData | null;
type SortDir = 'asc' | 'desc';

interface Column {
  key: string;
  label: string;
  width: number;
  align: 'left' | 'right';
  format?: (val: number) => string;
  dataKey?: keyof QuoteData;
}

function formatPrice(v: number): string {
  return v.toFixed(2);
}

function formatPct(v: number): string {
  return v.toFixed(2) + '%';
}

function formatVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '万';
  return String(v);
}

function formatAmount(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

const COLUMNS: Column[] = [
  { key: 'index', label: '#序号', width: 50, align: 'right' },
  { key: 'code', label: '代码', width: 75, align: 'left', dataKey: 'code' },
  { key: 'name', label: '名称', width: 80, align: 'left', dataKey: 'name' },
  { key: 'change_pct', label: '涨幅%', width: 75, align: 'right', dataKey: 'change_pct', format: formatPct },
  { key: 'price', label: '现价', width: 75, align: 'right', dataKey: 'price', format: formatPrice },
  { key: 'change_amount', label: '涨跌', width: 70, align: 'right', dataKey: 'change_amount', format: formatPrice },
  { key: 'volume', label: '总量', width: 80, align: 'right', dataKey: 'volume', format: formatVolume },
  { key: 'amount', label: '成交额', width: 90, align: 'right', dataKey: 'amount', format: formatAmount },
  { key: 'open', label: '今开', width: 70, align: 'right', dataKey: 'open', format: formatPrice },
  { key: 'high', label: '最高', width: 70, align: 'right', dataKey: 'high', format: formatPrice },
  { key: 'low', label: '最低', width: 70, align: 'right', dataKey: 'low', format: formatPrice },
  { key: 'prev_close', label: '昨收', width: 70, align: 'right', dataKey: 'prev_close', format: formatPrice },
  { key: 'turnover_rate', label: '换手%', width: 70, align: 'right', dataKey: 'turnover_rate', format: formatPct },
  { key: 'pe_ratio', label: '市盈率', width: 75, align: 'right', dataKey: 'pe_ratio', format: formatPrice },
  { key: 'amplitude', label: '振幅', width: 70, align: 'right', dataKey: 'amplitude', format: formatPct },
];

function getColorForValue(val: number): string {
  if (val > 0) return '#FF4444';
  if (val < 0) return '#00CC66';
  return '#ccc';
}

const MarketTable: React.FC = () => {
  const quotes = useQuotesStore((s) => s.quotes);
  const loading = useQuotesStore((s) => s.loading);
  const fetchAllQuotes = useQuotesStore((s) => s.fetchAllQuotes);
  const watchlistCodes = useWatchlistStore((s) => s.codes);
  const setCode = useChartStore((s) => s.setCode);
  const setActiveView = useChartStore((s) => s.setActiveView);

  const [sortKey, setSortKey] = useState<SortKey>('change_pct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quotes.size === 0) {
      void fetchAllQuotes();
    }
  }, [quotes.size, fetchAllQuotes]);

  const watchlistSet = useMemo(() => new Set(watchlistCodes), [watchlistCodes]);

  const sortedRows = useMemo(() => {
    const all = Array.from(quotes.values());

    const watchlistRows: QuoteData[] = [];
    const otherRows: QuoteData[] = [];
    for (const q of all) {
      if (watchlistSet.has(q.code)) {
        watchlistRows.push(q);
      } else {
        otherRows.push(q);
      }
    }

    const compareFn = (a: QuoteData, b: QuoteData) => {
      if (!sortKey) return 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    };

    watchlistRows.sort(compareFn);
    otherRows.sort(compareFn);

    return [...watchlistRows, ...otherRows];
  }, [quotes, watchlistSet, sortKey, sortDir]);

  const watchlistCount = useMemo(
    () => sortedRows.filter((r) => watchlistSet.has(r.code)).length,
    [sortedRows, watchlistSet],
  );

  const totalRows = sortedRows.length;
  const totalHeight = totalRows * ROW_HEIGHT;

  const containerHeight = containerRef.current
    ? containerRef.current.clientHeight - HEADER_HEIGHT
    : 600;

  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleEnd = Math.min(
    totalRows,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN,
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleHeaderClick = useCallback(
    (col: Column) => {
      if (!col.dataKey) return;
      if (sortKey === col.dataKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(col.dataKey);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const handleRowDoubleClick = useCallback(
    (code: string) => {
      setCode(code);
      setActiveView('chart');
    },
    [setCode, setActiveView],
  );

  const renderCell = (col: Column, row: QuoteData, rowIndex: number) => {
    if (col.key === 'index') {
      return String(rowIndex + 1);
    }
    if (col.dataKey) {
      const val = row[col.dataKey];
      if (col.format && typeof val === 'number') {
        return col.format(val);
      }
      return String(val);
    }
    return '';
  };

  const getCellColor = (col: Column, row: QuoteData): string => {
    if (col.key === 'code' || col.key === 'name' || col.key === 'index') return '#ccc';
    if (col.key === 'volume' || col.key === 'amount') return '#ccc';
    if (col.key === 'prev_close') return '#ccc';
    return getColorForValue(row.change_pct);
  };

  const visibleRows = [];
  for (let i = visibleStart; i < visibleEnd; i++) {
    const row = sortedRows[i];
    if (!row) continue;
    const isWatchlist = watchlistSet.has(row.code);

    visibleRows.push(
      <div
        key={row.code}
        style={{
          position: 'absolute',
          top: i * ROW_HEIGHT,
          left: 0,
          right: 0,
          height: ROW_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          borderLeft: isWatchlist ? '4px solid #FFD700' : '4px solid transparent',
          cursor: 'pointer',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = '#1a1a2e';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }}
        onDoubleClick={() => handleRowDoubleClick(row.code)}
      >
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            style={{
              width: col.width,
              minWidth: col.width,
              textAlign: col.align,
              paddingRight: col.align === 'right' ? 8 : 0,
              paddingLeft: col.align === 'left' ? 8 : 0,
              fontSize: 13,
              fontFamily:
                col.key === 'name'
                  ? 'inherit'
                  : "'Consolas', 'Monaco', 'Courier New', monospace",
              color: getCellColor(col, row),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {renderCell(col, row, i)}
          </div>
        ))}
      </div>,
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        color: '#ccc',
        fontSize: 13,
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: HEADER_HEIGHT,
          background: '#1a1a1a',
          borderBottom: '1px solid #333',
          flexShrink: 0,
          paddingLeft: 4,
        }}
      >
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            onClick={() => handleHeaderClick(col)}
            style={{
              width: col.width,
              minWidth: col.width,
              textAlign: col.align,
              paddingRight: col.align === 'right' ? 8 : 0,
              paddingLeft: col.align === 'left' ? 8 : 0,
              cursor: col.dataKey ? 'pointer' : 'default',
              fontSize: 12,
              fontWeight: 600,
              color: sortKey === col.dataKey ? '#FFD700' : '#999',
              whiteSpace: 'nowrap',
            }}
          >
            {col.label}
            {sortKey === col.dataKey && (sortDir === 'asc' ? ' ▲' : ' ▼')}
          </div>
        ))}
      </div>

      {/* Watchlist separator */}
      {watchlistCount > 0 && (
        <div
          style={{
            height: 1,
            background: '#FFD700',
            opacity: 0.3,
            flexShrink: 0,
          }}
        />
      )}

      {/* Loading indicator */}
      {loading && quotes.size === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>加载中...</div>
      )}

      {/* Virtual scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          paddingLeft: 4,
        }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>{visibleRows}</div>
      </div>
    </div>
  );
};

export default MarketTable;
