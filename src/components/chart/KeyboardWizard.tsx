import { useEffect, useRef, useState, useCallback } from 'react';
import { useChartStore } from '@/stores/chartStore';

interface StockItem {
  code: string;
  name: string;
  market: 'SH' | 'SZ';
}

// Module-level cache: fetched once per app session
let stockCache: StockItem[] | null = null;
let fetchPromise: Promise<StockItem[]> | null = null;

async function fetchStocks(): Promise<StockItem[]> {
  if (stockCache) return stockCache;
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch('http://localhost:8899/api/data/stocks')
    .then((r) => r.json())
    .then((data: { code: string; name: string; market: string }[]) => {
      stockCache = data.map((s) => ({
        code: s.code,
        name: s.name,
        market: (s.market === 'SH' ? 'SH' : 'SZ') as 'SH' | 'SZ',
      }));
      return stockCache;
    })
    .catch(() => {
      fetchPromise = null;
      return [];
    });
  return fetchPromise;
}

function marketLabel(item: StockItem): string {
  if (item.market === 'SH') return '上海A股';
  if (item.code.startsWith('300') || item.code.startsWith('301')) return '创业板';
  if (item.code.startsWith('002') || item.code.startsWith('003')) return '中小板';
  return '深圳A股';
}

function filterStocks(stocks: StockItem[], query: string): StockItem[] {
  const q = query.toLowerCase();
  return stocks
    .filter(
      (s) =>
        s.code.startsWith(query) ||
        s.name.toLowerCase().includes(q)
    )
    .slice(0, 20);
}

interface Props {
  /** Whether any other dialog is open — wizard should not activate then */
  anyDialogOpen: boolean;
}

export function KeyboardWizard({ anyDialogOpen }: Props): React.ReactElement | null {
  const setCode = useChartStore((s) => s.setCode);
  const setMarket = useChartStore((s) => s.setMarket);
  const setActiveView = useChartStore((s) => s.setActiveView);

  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [filtered, setFiltered] = useState<StockItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const anyDialogOpenRef = useRef(anyDialogOpen);
  useEffect(() => { anyDialogOpenRef.current = anyDialogOpen; });

  // Pre-fetch stocks on mount
  useEffect(() => {
    void fetchStocks().then((list) => setStocks(list));
  }, []);

  // Refilter whenever query or stocks change
  useEffect(() => {
    const results = filterStocks(stocks, query);
    setFiltered(results);
    setSelectedIdx(0);
  }, [query, stocks]);

  const close = useCallback(() => {
    setVisible(false);
    setQuery('');
  }, []);

  const confirm = useCallback(
    (item?: StockItem) => {
      const target = item ?? filtered[selectedIdx];
      if (!target) { close(); return; }
      setCode(target.code);
      setMarket(target.market);
      setActiveView('chart');
      close();
    },
    [filtered, selectedIdx, setCode, setMarket, setActiveView, close]
  );

  // Global keydown: digit key opens wizard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (inInput || anyDialogOpenRef.current) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Digit key (0-9) triggers wizard
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        setQuery(e.key);
        setVisible(true);
        // Focus input after render
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when wizard opens
  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [visible]);

  if (!visible) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
  };

  const wizardStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 40,
    right: 20,
    width: 320,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    zIndex: 2001,
    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '8px 10px',
    outline: 'none',
    boxSizing: 'border-box',
    borderRadius: '4px 4px 0 0',
  };

  const listStyle: React.CSSProperties = {
    maxHeight: 260,
    overflowY: 'auto',
  };

  const itemStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    cursor: 'pointer',
    background: isSelected ? 'var(--bg-panel)' : 'transparent',
    borderLeft: isSelected ? '2px solid var(--color-up)' : '2px solid transparent',
  });

  const emptyStyle: React.CSSProperties = {
    padding: '12px 10px',
    color: 'var(--text-muted)',
    fontSize: 12,
    textAlign: 'center',
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
      return;
    }
  };

  return (
    <>
      {/* Transparent overlay to capture outside clicks */}
      <div style={overlayStyle} onClick={close} />
      <div style={wizardStyle} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          style={inputStyle}
          value={query}
          placeholder="输入代码或名称..."
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        <div style={listStyle}>
          {filtered.length === 0 ? (
            <div style={emptyStyle}>
              {query.length === 0 ? '请输入股票代码或名称' : '无匹配结果'}
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.code}
                style={itemStyle(idx === selectedIdx)}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => confirm(item)}
              >
                <span
                  style={{
                    color: 'var(--color-up)',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    marginRight: 8,
                    minWidth: 60,
                  }}
                >
                  {item.code}
                </span>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    flex: 1,
                  }}
                >
                  {item.name}
                </span>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    marginLeft: 8,
                  }}
                >
                  {marketLabel(item)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
