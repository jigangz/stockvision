import { useState } from 'react';
import { useDataStore } from '@/stores/dataStore';

interface Props {
  onClose: () => void;
}

interface StatsResult {
  period: { start_date: string; end_date: string; trading_days: number };
  left: {
    period_return: number;
    period_high: number;
    period_high_date: string;
    period_low: number;
    period_low_date: string;
    period_open: number;
    period_close: number;
    period_amplitude: number;
    period_avg_price: number;
  };
  right: {
    total_volume: number;
    total_amount: number;
    avg_daily_volume: number;
    avg_daily_amount: number;
    return_std: number;
    max_daily_return: number;
    max_daily_loss: number;
    annualized_volatility: number;
  };
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialog: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '16px 20px',
  minWidth: 560,
  maxWidth: 680,
  color: 'var(--text-primary)',
  fontSize: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 'bold',
  marginBottom: 12,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
  paddingBottom: 8,
};

const dateRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};

const dateInput: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: 12,
  padding: '3px 6px',
  width: 110,
};

const twoCol: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const colTitle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  marginBottom: 6,
  borderBottom: '1px solid var(--border)',
  paddingBottom: 4,
};

const statRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

const statLabel: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
};

const btnRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 14,
};

const btn: React.CSSProperties = {
  padding: '4px 14px',
  fontSize: 12,
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

function formatNum(v: number, decimals = 2): string {
  return v.toFixed(decimals);
}

function formatVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

function formatAmount(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿元';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万元';
  return v.toFixed(2) + '元';
}

function ReturnValue({ v }: { v: number }) {
  const color = v > 0 ? 'var(--color-up)' : v < 0 ? 'var(--color-down)' : 'var(--text-primary)';
  return <span style={{ color, fontSize: 11 }}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
}

export function IntervalStatsDialog({ onClose }: Props) {
  const candles = useDataStore((s) => s.candles);

  const defaultStart = candles.length > 0 ? String(candles[0].time).slice(0, 10) : '';
  const defaultEnd = candles.length > 0 ? String(candles[candles.length - 1].time).slice(0, 10) : '';

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [result, setResult] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQuery = async () => {
    if (!candles.length) return;
    setLoading(true);
    setError('');
    try {
      const body = {
        data: candles.map((c) => ({
          date: String(c.time).slice(0, 10),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          amount: (c as unknown as Record<string, unknown>).amount ?? 0,
        })),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };
      const res = await fetch('http://localhost:8899/api/stats/interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '请求失败' }));
        setError((err as { detail?: string }).detail ?? '请求失败');
        return;
      }
      const data = (await res.json()) as StatsResult;
      setResult(data);
    } catch {
      setError('无法连接到后端服务');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>区间统计</div>

        {/* Date range picker */}
        <div style={dateRow}>
          <span style={statLabel}>起始日期</span>
          <input
            type="date"
            style={dateInput}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span style={statLabel}>结束日期</span>
          <input
            type="date"
            style={dateInput}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <button style={btnPrimary} onClick={() => void handleQuery()} disabled={loading}>
            {loading ? '计算中...' : '查询'}
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--color-up)', fontSize: 11, marginBottom: 8 }}>{error}</div>
        )}

        {result && (
          <>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>
              统计区间：{result.period.start_date} ~ {result.period.end_date}，共 {result.period.trading_days} 个交易日
            </div>

            <div style={twoCol}>
              {/* Left column: price/K-line stats */}
              <div>
                <div style={colTitle}>价格统计</div>
                <div style={statRow}>
                  <span style={statLabel}>区间涨幅</span>
                  <ReturnValue v={result.left.period_return} />
                </div>
                <div style={statRow}>
                  <span style={statLabel}>期初开盘</span>
                  <span style={{ fontSize: 11 }}>{formatNum(result.left.period_open)}</span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>期末收盘</span>
                  <span style={{ fontSize: 11 }}>{formatNum(result.left.period_close)}</span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>区间最高</span>
                  <span style={{ color: 'var(--color-up)', fontSize: 11 }}>
                    {formatNum(result.left.period_high)}
                    <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({result.left.period_high_date})</span>
                  </span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>区间最低</span>
                  <span style={{ color: 'var(--color-down)', fontSize: 11 }}>
                    {formatNum(result.left.period_low)}
                    <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({result.left.period_low_date})</span>
                  </span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>区间振幅</span>
                  <span style={{ fontSize: 11 }}>{formatNum(result.left.period_amplitude)}%</span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>区间均价</span>
                  <span style={{ fontSize: 11 }}>{formatNum(result.left.period_avg_price)}</span>
                </div>
              </div>

              {/* Right column: capital flow + volatility stats */}
              <div>
                <div style={colTitle}>资金与波动</div>
                <div style={statRow}>
                  <span style={statLabel}>区间总量</span>
                  <span style={{ fontSize: 11 }}>{formatVolume(result.right.total_volume)}</span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>区间总额</span>
                  <span style={{ fontSize: 11 }}>{formatAmount(result.right.total_amount)}</span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>日均成交量</span>
                  <span style={{ fontSize: 11 }}>{formatVolume(result.right.avg_daily_volume)}</span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>日均成交额</span>
                  <span style={{ fontSize: 11 }}>{formatAmount(result.right.avg_daily_amount)}</span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>最大单日涨幅</span>
                  <span style={{ color: 'var(--color-up)', fontSize: 11 }}>
                    +{formatNum(result.right.max_daily_return)}%
                  </span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>最大单日跌幅</span>
                  <span style={{ color: 'var(--color-down)', fontSize: 11 }}>
                    {formatNum(result.right.max_daily_loss)}%
                  </span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>日收益标准差</span>
                  <span style={{ fontSize: 11 }}>{formatNum(result.right.return_std, 4)}%</span>
                </div>
                <div style={statRow}>
                  <span style={statLabel}>年化波动率</span>
                  <span style={{ fontSize: 11 }}>{formatNum(result.right.annualized_volatility)}%</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={btnRow}>
          <button style={btn} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
