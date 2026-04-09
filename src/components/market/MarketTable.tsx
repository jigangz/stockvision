import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuotesStore, type QuoteData } from '../../stores/quotesStore';
import { useWatchlistStore } from '../../stores/watchlistStore';
import { useChartStore } from '../../stores/chartStore';

const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 28;
const OVERSCAN = 8;

type SortKey = keyof QuoteData | null;
type SortDir = 'asc' | 'desc';

interface Column {
  key: string;
  label: string;
  width: number;
  align: 'left' | 'right';
  dataKey?: keyof QuoteData;
  colorFn?: (row: QuoteData) => number;
}

function fmt2(v: number): string {
  return v.toFixed(2);
}

function fmtPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function fmtVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '万';
  return String(v);
}

function fmtAmount(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

function fmtPe(v: number): string {
  return v > 0 ? v.toFixed(1) : '--';
}

function getMarket(code: string): 'SH' | 'SZ' {
  return code[0] === '6' ? 'SH' : 'SZ';
}

const COLUMNS: Column[] = [
  { key: 'index', label: '#', width: 44, align: 'right' },
  { key: 'code', label: '代码', width: 72, align: 'left', dataKey: 'code' },
  { key: 'name', label: '名称', width: 80, align: 'left', dataKey: 'name' },
  { key: 'change_pct', label: '涨幅%', width: 72, align: 'right', dataKey: 'change_pct', colorFn: (r) => r.change_pct },
  { key: 'price', label: '现价', width: 70, align: 'right', dataKey: 'price', colorFn: (r) => r.change_pct },
  { key: 'change_amount', label: '涨跌', width: 66, align: 'right', dataKey: 'change_amount', colorFn: (r) => r.change_amount },
  { key: 'volume', label: '总量', width: 82, align: 'right', dataKey: 'volume' },
  { key: 'amount', label: '成交额', width: 90, align: 'right', dataKey: 'amount' },
  { key: 'open', label: '今开', width: 68, align: 'right', dataKey: 'open' },
  { key: 'high', label: '最高', width: 68, align: 'right', dataKey: 'high', colorFn: (r) => r.high - r.prev_close },
  { key: 'low', label: '最低', width: 68, align: 'right', dataKey: 'low', colorFn: (r) => r.low - r.prev_close },
  { key: 'prev_close', label: '昨收', width: 68, align: 'right', dataKey: 'prev_close' },
  { key: 'turnover_rate', label: '换手%', width: 68, align: 'right', dataKey: 'turnover_rate', colorFn: (r) => r.change_pct },
  { key: 'pe_ratio', label: '市盈率', width: 68, align: 'right', dataKey: 'pe_ratio' },
  { key: 'amplitude', label: '振幅', width: 60, align: 'right', dataKey: 'amplitude' },
];

function renderValue(col: Column, row: QuoteData, rowIndex: number): string {
  if (col.key === 'index') return String(rowIndex + 1);
  if (!col.dataKey) return '';
  const val = row[col.dataKey];
  if (typeof val !== 'number') return String(val);
  switch (col.key) {
    case 'change_pct': return fmtPct(val);
    case 'change_amount': return (val >= 0 ? '+' : '') + fmt2(val);
    case 'volume': return fmtVolume(val);
    case 'amount': return fmtAmount(val);
    case 'pe_ratio': return fmtPe(val);
    case 'turnover_rate': return val.toFixed(2) + '%';
    case 'amplitude': return val.toFixed(2) + '%';
    default: return fmt2(val);
  }
}

function colorVar(v: number): string {
  if (v > 0) return 'var(--color-up)';
  if (v < 0) return 'var(--color-down)';
  return 'var(--color-flat)';
}

const MarketTable: React.FC = () => {
  const quotes = useQuotesStore((s) => s.quotes);
  const loading = useQuotesStore((s) => s.loading);
  const startPolling = useQuotesStore((s) => s.startPolling);
  const stopPolling = useQuotesStore((s) => s.stopPolling);
  const watchlistCodes = useWatchlistStore((s) => s.codes);
  const setCode = useChartStore((s) => s.setCode);
  const setMarket = useChartStore((s) => s.setMarket);
  const setActiveView = useChartStore((s) => s.setActiveView);

  const [sortKey, setSortKey] = useState<SortKey>('change_pct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start polling while market view is mounted
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Keyboard: F6 toggles view, Esc → chart view
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        setActiveView('chart');
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveView]);

  // Track container height for virtual scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const watchlistSet = useMemo(() => new Set(watchlistCodes), [watchlistCodes]);

  const sortedRows = useMemo(() => {
    const all = Array.from(quotes.values());
    const watchlistRows: QuoteData[] = [];
    const otherRows: QuoteData[] = [];
    for (const q of all) {
      if (watchlistSet.has(q.code)) watchlistRows.push(q);
      else otherRows.push(q);
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

  const totalRows = sortedRows.length;
  const totalHeight = totalRows * ROW_HEIGHT;

  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleEnd = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);

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
    (row: QuoteData) => {
      setCode(row.code);
      setMarket(getMarket(row.code));
      setActiveView('chart');
    },
    [setCode, setMarket, setActiveView],
  );

  const visibleRowEls: React.ReactNode[] = [];
  for (let i = visibleStart; i < visibleEnd; i++) {
    const row = sortedRows[i];
    if (!row) continue;
    const isPinned = watchlistSet.has(row.code);
    const isEven = i % 2 === 0;

    visibleRowEls.push(
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
          borderLeft: isPinned ? '3px solid var(--ma5)' : '3px solid transparent',
          background: isEven ? 'var(--bg-primary)' : 'var(--bg-panel)',
          cursor: 'default',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = isEven
            ? 'var(--bg-primary)'
            : 'var(--bg-panel)';
        }}
        onDoubleClick={() => handleRowDoubleClick(row)}
      >
        {COLUMNS.map((col) => {
          const colorValue = col.colorFn ? col.colorFn(row) : null;
          const color = colorValue !== null ? colorVar(colorValue) : 'var(--text-secondary)';
          return (
            <div
              key={col.key}
              style={{
                width: col.width,
                minWidth: col.width,
                textAlign: col.align,
                paddingRight: col.align === 'right' ? 6 : 0,
                paddingLeft: col.align === 'left' ? 6 : 0,
                fontSize: 12,
                fontFamily: col.key === 'name' ? 'inherit' : 'Consolas, Monaco, monospace',
                color,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {renderValue(col, row, i)}
            </div>
          );
        })}
      </div>,
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--text-secondary)',
        fontSize: 12,
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: HEADER_HEIGHT,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          paddingLeft: 3,
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
              paddingRight: col.align === 'right' ? 6 : 0,
              paddingLeft: col.align === 'left' ? 6 : 0,
              cursor: col.dataKey ? 'pointer' : 'default',
              fontSize: 11,
              fontWeight: 600,
              color: sortKey === col.dataKey ? 'var(--ma5)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {col.label}
            {sortKey === col.dataKey && (sortDir === 'asc' ? ' ▲' : ' ▼')}
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      {loading && quotes.size === 0 && (
        <div
          style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}
        >
          加载中...
        </div>
      )}

      {/* Virtual scroll body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          paddingLeft: 0,
        }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRowEls}
        </div>
      </div>
    </div>
  );
};

export { MarketTable };
export default MarketTable;
