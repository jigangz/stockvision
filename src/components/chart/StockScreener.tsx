import { useState, useCallback, useEffect, useRef } from 'react';
import { useChartStore } from '@/stores/chartStore';

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface StockResult {
  code: string;
  name: string;
  market: 'SH' | 'SZ';
  sector: string;
  close: number;
  open: number;
  high: number;
  low: number;
  change_pct: number;
  volume: number;
  amount: number;
  amplitude: number;
}

interface ScreenerResponse {
  total: number;
  stocks: StockResult[];
  fields: Record<string, string>;
  scanned?: number;
}

const FIELDS = [
  { key: 'close', label: '最新价' },
  { key: 'open', label: '开盘价' },
  { key: 'high', label: '最高价' },
  { key: 'low', label: '最低价' },
  { key: 'change_pct', label: '涨幅%' },
  { key: 'volume', label: '成交量' },
  { key: 'amount', label: '成交额' },
  { key: 'amplitude', label: '振幅%' },
];

const OPERATORS = ['>', '<', '>=', '<=', '==', '!='];

const SORT_COLUMNS: { key: keyof StockResult; label: string }[] = [
  { key: 'code', label: '代码' },
  { key: 'name', label: '名称' },
  { key: 'close', label: '最新价' },
  { key: 'change_pct', label: '涨幅%' },
  { key: 'volume', label: '成交量' },
  { key: 'amount', label: '成交额' },
  { key: 'amplitude', label: '振幅%' },
  { key: 'sector', label: '板块' },
];

interface Props {
  onClose: () => void;
}

/* --- styles --- */
const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialog: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  width: '80vw',
  maxWidth: 960,
  height: '80vh',
  color: 'var(--text-primary)',
  fontSize: 12,
};

const titleBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
  fontWeight: 'bold',
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '12px 16px',
  gap: 10,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  marginBottom: 6,
};

const conditionRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 4,
};

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: 11,
  padding: '3px 6px',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: 11,
  padding: '3px 6px',
  width: 90,
};

const formulaInput: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: 11,
  padding: '4px 8px',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'monospace',
  resize: 'none',
};

const btn: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 11,
  border: '1px solid var(--border)',
  borderRadius: 2,
  cursor: 'pointer',
  background: 'var(--bg-panel)',
  color: 'var(--text-primary)',
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: '#CC3333',
  borderColor: '#CC3333',
};

const btnSmall: React.CSSProperties = {
  ...btn,
  padding: '2px 7px',
  fontSize: 10,
  color: 'var(--text-muted)',
};

const tableContainer: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 2,
};

const thStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 8px',
  textAlign: 'left',
  fontSize: 11,
  color: active ? 'var(--color-up)' : 'var(--text-muted)',
  background: 'var(--bg-panel)',
  position: 'sticky',
  top: 0,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  borderBottom: '1px solid var(--border)',
});

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 11,
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  whiteSpace: 'nowrap',
};

function formatVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

function formatAmount(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(2);
}

export function StockScreener({ onClose }: Props) {
  const setCode = useChartStore((s) => s.setCode);
  const setMarket = useChartStore((s) => s.setMarket);

  const [conditions, setConditions] = useState<Condition[]>([
    { field: 'change_pct', operator: '>', value: '' },
  ]);
  const [formula, setFormula] = useState('');
  const [sortBy, setSortBy] = useState<keyof StockResult>('change_pct');
  const [sortDesc, setSortDesc] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScreenerResponse | null>(null);
  // Simulated scan progress (0–100) shown while waiting for backend
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate progress bar while loading
  useEffect(() => {
    if (loading) {
      setProgress(0);
      progressTimerRef.current = setInterval(() => {
        setProgress((p) => {
          // Accelerate to 80% quickly, then slow down (never reaches 100 until done)
          if (p < 60) return p + 8;
          if (p < 80) return p + 3;
          if (p < 92) return p + 1;
          return p;
        });
      }, 120);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setProgress(100);
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [loading]);

  const addCondition = () => {
    setConditions((prev) => [...prev, { field: 'close', operator: '>', value: '' }]);
  };

  const removeCondition = (i: number) => {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateCondition = (i: number, key: keyof Condition, val: string) => {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)));
  };

  const handleSort = (col: keyof StockResult) => {
    if (col === sortBy) {
      setSortDesc((d) => !d);
    } else {
      setSortBy(col);
      setSortDesc(true);
    }
  };

  const handleFilter = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const validConditions = conditions
        .filter((c) => c.value.trim() !== '')
        .map((c) => ({
          field: c.field,
          operator: c.operator,
          value: parseFloat(c.value),
        }))
        .filter((c) => !isNaN(c.value));

      const body = {
        conditions: validConditions,
        formula: formula.trim() || null,
        sort_by: sortBy,
        sort_desc: sortDesc,
        limit: 200,
      };

      const res = await fetch('http://localhost:8899/api/screener/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '请求失败' }));
        setError((err as { detail?: string }).detail ?? '请求失败');
        return;
      }

      const data = (await res.json()) as ScreenerResponse;
      setResult(data);
    } catch {
      setError('无法连接到后端服务');
    } finally {
      setLoading(false);
    }
  }, [conditions, formula, sortBy, sortDesc]);

  const handleRowClick = (stock: StockResult) => {
    setCode(stock.code);
    setMarket(stock.market);
    onClose();
  };

  // Sort result locally when sort params change
  const sortedStocks = result
    ? [...result.stocks].sort((a, b) => {
        const av = a[sortBy];
        const bv = b[sortBy];
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDesc ? bv - av : av - bv;
        }
        return sortDesc
          ? String(bv).localeCompare(String(av))
          : String(av).localeCompare(String(bv));
      })
    : [];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div style={titleBar}>
          <span>选股筛选器</span>
          <button style={btn} onClick={onClose}>×</button>
        </div>

        <div style={bodyStyle}>
          {/* Condition builder */}
          <div>
            <div style={sectionTitle}>筛选条件（AND 逻辑）</div>
            {conditions.map((cond, i) => (
              <div key={i} style={conditionRow}>
                <select
                  style={selectStyle}
                  value={cond.field}
                  onChange={(e) => updateCondition(i, 'field', e.target.value)}
                >
                  {FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <select
                  style={{ ...selectStyle, width: 60 }}
                  value={cond.operator}
                  onChange={(e) => updateCondition(i, 'operator', e.target.value)}
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="数值"
                  value={cond.value}
                  onChange={(e) => updateCondition(i, 'value', e.target.value)}
                />
                <button style={btnSmall} onClick={() => removeCondition(i)}>删除</button>
              </div>
            ))}
            <button style={{ ...btnSmall, marginTop: 2 }} onClick={addCondition}>+ 添加条件</button>
          </div>

          {/* Formula condition */}
          <div>
            <div style={sectionTitle}>公式条件（可选，通达信语法，末值非零则通过）</div>
            <textarea
              style={{ ...formulaInput, height: 40 }}
              placeholder="例: CLOSE > MA(CLOSE, 20)"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              rows={2}
            />
          </div>

          {/* Run button + progress + error */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={btnPrimary} onClick={() => void handleFilter()} disabled={loading}>
                {loading ? '筛选中...' : '开始筛选'}
              </button>
              {result && !loading && (
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  已扫描 {result.scanned ?? result.total} 只，命中 {result.total} 只
                </span>
              )}
              {error && (
                <span style={{ color: 'var(--color-up)', fontSize: 11 }}>{error}</span>
              )}
            </div>
            {/* Progress bar — visible while loading or just after completion */}
            {(loading || progress === 100) && progress > 0 && (
              <div style={{
                height: 3,
                background: 'var(--bg-panel)',
                borderRadius: 2,
                overflow: 'hidden',
                width: '100%',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: loading ? 'var(--color-up)' : 'var(--color-down)',
                  borderRadius: 2,
                  transition: 'width 0.12s ease-out, background 0.3s',
                }} />
              </div>
            )}
          </div>

          {/* Results table */}
          {result && (
            <div style={tableContainer}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {SORT_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        style={thStyle(sortBy === col.key)}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        {sortBy === col.key ? (sortDesc ? ' ▼' : ' ▲') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStocks.map((stock) => {
                    const isUp = stock.change_pct > 0;
                    const isDown = stock.change_pct < 0;
                    const changeColor = isUp
                      ? 'var(--color-up)'
                      : isDown
                      ? 'var(--color-down)'
                      : 'var(--text-primary)';
                    return (
                      <tr
                        key={stock.code}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleRowClick(stock)}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            'rgba(255,255,255,0.05)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = '';
                        }}
                      >
                        <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{stock.code}</td>
                        <td style={tdStyle}>{stock.name}</td>
                        <td style={{ ...tdStyle, color: changeColor }}>{stock.close.toFixed(2)}</td>
                        <td style={{ ...tdStyle, color: changeColor }}>
                          {stock.change_pct > 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                        </td>
                        <td style={tdStyle}>{formatVolume(stock.volume)}</td>
                        <td style={tdStyle}>{formatAmount(stock.amount)}</td>
                        <td style={tdStyle}>{stock.amplitude.toFixed(2)}%</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{stock.sector}</td>
                      </tr>
                    );
                  })}
                  {sortedStocks.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}
                      >
                        没有符合条件的股票
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
