import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useChartStore } from '@/stores/chartStore';
import { useQuotesStore } from '@/stores/quotesStore';
import { detectMarket } from '@/utils/market';

interface Props {
  onClose: () => void;
}

interface StockItem {
  code: string;
  name: string;
  market: string;
}

const MAX_RESULTS = 20;

/** Market label color */
function marketColor(m: string): string {
  if (m === 'SH') return '#FF6600';
  if (m === 'SZ') return '#00AAFF';
  if (m === 'BJ') return '#CCAA00';
  return '#888';
}

/** Market display label */
function marketLabel(m: string): string {
  if (m === 'SH') return '沪A';
  if (m === 'SZ') return '深A';
  if (m === 'BJ') return '京A';
  return m;
}

export function StockCodeInput({ onClose }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const setCode = useChartStore((s) => s.setCode);
  const setMarket = useChartStore((s) => s.setMarket);
  const quotes = useQuotesStore((s) => s.quotes);
  const fetchAllQuotes = useQuotesStore((s) => s.fetchAllQuotes);

  // Fetch stock list on mount if empty
  useEffect(() => {
    if (quotes.size === 0) void fetchAllQuotes();
    inputRef.current?.focus();
  }, []);

  // Build full stock list from quotes store
  const allStocks = useMemo<StockItem[]>(() => {
    const items: StockItem[] = [];
    quotes.forEach((q) => {
      items.push({
        code: q.code,
        name: q.name ?? '',
        market: detectMarket(q.code),
      });
    });
    // Sort by code
    items.sort((a, b) => a.code.localeCompare(b.code));
    return items;
  }, [quotes]);

  // Filter stocks by query (match code prefix or name contains)
  const filtered = useMemo<StockItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: StockItem[] = [];
    for (const s of allStocks) {
      if (results.length >= MAX_RESULTS) break;
      if (s.code.startsWith(q) || s.name.toLowerCase().includes(q)) {
        results.push(s);
      }
    }
    return results;
  }, [query, allStocks]);

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [filtered]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const confirmStock = useCallback((stock: StockItem) => {
    setCode(stock.code);
    setMarket(stock.market as 'SH' | 'SZ' | 'BJ');
    onClose();
  }, [setCode, setMarket, onClose]);

  const handleConfirmCurrent = useCallback(() => {
    if (filtered.length > 0 && selectedIdx < filtered.length) {
      confirmStock(filtered[selectedIdx]);
    } else {
      // Direct code input (no match in list)
      const trimmed = query.trim();
      if (trimmed.length >= 6) {
        setCode(trimmed);
        setMarket(detectMarket(trimmed));
        onClose();
      }
    }
  }, [filtered, selectedIdx, query, confirmStock, setCode, setMarket, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmCurrent();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered.length, handleConfirmCurrent, onClose]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        {/* Input area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>股票代码</span>
          <input
            ref={inputRef}
            style={inputFieldStyle}
            value={query}
            placeholder="输入代码或名称，如 600519 或 茅台"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Results list */}
        {filtered.length > 0 && (
          <div ref={listRef} style={listStyle}>
            {/* Header */}
            <div style={headerRowStyle}>
              <span style={{ width: 70 }}>代码</span>
              <span style={{ flex: 1 }}>名称</span>
              <span style={{ width: 50, textAlign: 'right' }}>市场</span>
            </div>
            {filtered.map((s, i) => (
              <div
                key={`${s.code}-${s.market}`}
                style={{
                  ...rowStyle,
                  background: i === selectedIdx ? 'rgba(52, 152, 219, 0.3)' : 'transparent',
                }}
                onClick={() => confirmStock(s)}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span style={{
                  width: 70,
                  color: query && s.code.startsWith(query.trim()) ? '#FFFF00' : 'var(--text-primary)',
                  fontWeight: 'bold',
                }}>
                  {s.code}
                </span>
                <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name || '--'}
                </span>
                <span style={{
                  width: 50,
                  textAlign: 'right',
                  color: marketColor(s.market),
                  fontSize: 10,
                }}>
                  {marketLabel(s.market)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No results hint */}
        {query.trim() && filtered.length === 0 && allStocks.length > 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: '8px 0', textAlign: 'center' }}>
            未找到匹配的股票
          </div>
        )}

        {/* Loading hint */}
        {allStocks.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: '8px 0', textAlign: 'center' }}>
            正在加载股票列表...
          </div>
        )}

        {/* Footer hint */}
        <div style={{ color: 'var(--text-muted)', fontSize: 10, display: 'flex', gap: 12, marginTop: 2 }}>
          <span>上/下 选择</span>
          <span>Enter 确认</span>
          <span>Esc 关闭</span>
          {allStocks.length > 0 && <span style={{ marginLeft: 'auto' }}>{allStocks.length} 只股票</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 120,
  zIndex: 1000,
};

const boxStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '1px solid #3498db',
  borderRadius: 4,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  width: 380,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
};

const inputFieldStyle: React.CSSProperties = {
  background: '#0a0a1a',
  border: '1px solid #333',
  borderRadius: 2,
  color: '#FFFF00',
  fontSize: 16,
  padding: '6px 10px',
  flex: 1,
  outline: 'none',
  fontFamily: 'monospace',
  fontWeight: 'bold',
  letterSpacing: 2,
};

const listStyle: React.CSSProperties = {
  maxHeight: 340,
  overflowY: 'auto',
  scrollbarWidth: 'thin',
  border: '1px solid #333',
  borderRadius: 2,
  background: '#0a0a1a',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  padding: '4px 8px',
  fontSize: 10,
  color: '#666',
  borderBottom: '1px solid #222',
  position: 'sticky',
  top: 0,
  background: '#0a0a1a',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'monospace',
  borderBottom: '1px solid #111',
};
