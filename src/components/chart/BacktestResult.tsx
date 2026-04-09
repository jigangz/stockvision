import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { init as initKChart, dispose as disposeKChart } from 'klinecharts';
import { darkStyles } from '@/theme/klineTheme';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';

interface Props {
  onClose: () => void;
}

interface TradeRecord {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
  hold_bars: number;
  direction: string;
}

interface EquityPoint {
  date: string;
  equity: number;
}

interface BacktestResultData {
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  tradeCount: number;
  avgHoldDays: number;
  initialCapital: number;
  finalEquity: number;
  equityCurve: EquityPoint[];
  trades: TradeRecord[];
  code: string;
  market: string;
  barCount: number;
}

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
  padding: '16px 20px',
  width: 860,
  maxWidth: '96vw',
  maxHeight: '92vh',
  overflowY: 'auto',
  color: 'var(--text-primary)',
  fontSize: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'bold',
  marginBottom: 14,
  borderBottom: '1px solid var(--border)',
  paddingBottom: 8,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const labelStyle: React.CSSProperties = { color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  padding: '4px 8px',
  fontFamily: 'monospace',
  fontSize: 12,
  boxSizing: 'border-box',
};

const btnStyle = (primary = false): React.CSSProperties => ({
  padding: '5px 16px',
  borderRadius: 3,
  border: primary ? 'none' : '1px solid var(--border)',
  background: primary ? 'var(--color-up)' : 'transparent',
  color: primary ? '#fff' : 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 12,
  marginLeft: 8,
});

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 120,
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderRadius: 3,
      padding: '8px 12px',
      textAlign: 'center',
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 'bold', color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function EquityCurveChart({ equityCurve, initialCapital }: { equityCurve: EquityPoint[]; initialCapital: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || equityCurve.length < 2) return;

    const chart = initKChart(el, {
      styles: darkStyles as never,
    });
    if (!chart) return;

    // Convert equity curve to KLineData format (line chart using close only)
    const klineData = equityCurve.map((ep) => ({
      timestamp: new Date(ep.date).getTime(),
      open: ep.equity,
      high: ep.equity,
      low: ep.equity,
      close: ep.equity,
      volume: 0,
    }));

    // Feed data via DataLoader
    chart.setSymbol({ ticker: 'equity', pricePrecision: 2, volumePrecision: 0 });
    chart.setPeriod({ type: 'day', span: 1 });
    chart.setDataLoader({
      getBars: ({ callback }) => {
        callback(klineData, false);
      },
    });

    // Add benchmark horizontal line overlay at initialCapital
    const firstTs = new Date(equityCurve[0].date).getTime();
    chart.createOverlay({
      name: 'horizontalStraightLine',
      points: [{ timestamp: firstTs, value: initialCapital }],
      styles: {
        line: { color: '#FFFFFF', size: 1, style: 'dashed' },
      },
    });

    return () => disposeKChart(el);
  }, [equityCurve, initialCapital]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 200, background: 'var(--bg-panel)', borderRadius: 3 }}
    />
  );
}

function KLineWithMarkers({
  candles,
  trades,
}: {
  candles: { date: string; open: number; high: number; low: number; close: number }[];
  trades: TradeRecord[];
}) {
  if (!candles.length) return null;

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !candles.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = svgRef.current.clientWidth || 780;
    const H = 180;
    const margin = { top: 10, right: 20, bottom: 30, left: 60 };
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Show last 120 bars
    const visible = candles.slice(-120);
    const barWidth = Math.max(1, w / visible.length - 1);

    const prices = visible.flatMap((c) => [c.high, c.low]);
    const minPrice = Math.min(...prices) * 0.998;
    const maxPrice = Math.max(...prices) * 1.002;

    const xScale = d3.scaleLinear().domain([0, visible.length - 1]).range([0, w]);
    const yScale = d3.scaleLinear().domain([minPrice, maxPrice]).range([h, 0]);

    // Grid
    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(4))
      .enter()
      .append('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', 'var(--grid-line)').attr('stroke-width', 0.5);

    // Candlesticks
    visible.forEach((c, i) => {
      const x = xScale(i);
      const isUp = c.close >= c.open;
      const color = isUp ? 'var(--color-up)' : 'var(--color-down)';
      const top = yScale(Math.max(c.open, c.close));
      const bot = yScale(Math.min(c.open, c.close));
      const bodyH = Math.max(1, bot - top);

      // Wick
      g.append('line')
        .attr('x1', x).attr('x2', x)
        .attr('y1', yScale(c.high)).attr('y2', yScale(c.low))
        .attr('stroke', color).attr('stroke-width', 0.8);

      // Body
      g.append('rect')
        .attr('x', x - barWidth / 2).attr('y', top)
        .attr('width', barWidth).attr('height', bodyH)
        .attr('fill', isUp ? 'var(--color-up)' : 'var(--color-down)');
    });

    // Trade markers
    const dateToIdx = new Map(visible.map((c, i) => [c.date, i]));

    trades.forEach((t) => {
      const buyIdx = dateToIdx.get(t.entry_date);
      const sellIdx = dateToIdx.get(t.exit_date);

      if (buyIdx !== undefined) {
        const x = xScale(buyIdx);
        const y = yScale(visible[buyIdx].low) + 14;
        // Red up arrow (buy)
        g.append('polygon')
          .attr('points', `${x},${y - 10} ${x - 5},${y} ${x + 5},${y}`)
          .attr('fill', 'var(--color-up)');
        g.append('text')
          .attr('x', x).attr('y', y + 10)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--color-up)')
          .attr('font-size', 9)
          .text('B');
      }

      if (sellIdx !== undefined) {
        const x = xScale(sellIdx);
        const y = yScale(visible[sellIdx].high) - 14;
        // Green down arrow (sell)
        g.append('polygon')
          .attr('points', `${x},${y + 10} ${x - 5},${y} ${x + 5},${y}`)
          .attr('fill', 'var(--color-down)');
        g.append('text')
          .attr('x', x).attr('y', y - 4)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--color-down)')
          .attr('font-size', 9)
          .text('S');
      }
    });

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat((v) => String(Number(v).toFixed(2))))
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '10');

    // X axis
    const step = Math.max(1, Math.floor(visible.length / 5));
    visible.forEach((c, i) => {
      if (i % step === 0 || i === visible.length - 1) {
        g.append('text')
          .attr('x', xScale(i))
          .attr('y', h + 18)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--text-muted)')
          .attr('font-size', '10')
          .text(c.date.slice(0, 10));
      }
    });
  }, [candles, trades]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={180}
      style={{ display: 'block', background: 'var(--bg-panel)', borderRadius: 3 }}
    />
  );
}

export function BacktestResult({ onClose }: Props): React.ReactElement {
  const candles = useDataStore((s) => s.candles);
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);
  const currentPeriod = useChartStore((s) => s.currentPeriod);

  const [buyFormula, setBuyFormula] = useState('CROSS(CLOSE, MA(CLOSE,5))');
  const [sellFormula, setSellFormula] = useState('CROSS(MA(CLOSE,5), CLOSE)');
  const [initialCapital, setInitialCapital] = useState('100000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResultData | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('http://localhost:8899/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: currentCode,
          market: currentMarket,
          period: currentPeriod,
          buy_formula: buyFormula,
          sell_formula: sellFormula,
          initial_capital: parseFloat(initialCapital) || 100000,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json() as { detail?: string };
        setError(err.detail ?? '回测失败');
        return;
      }
      const data = await resp.json() as BacktestResultData;
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const totalReturnColor = result && result.totalReturn >= 0 ? 'var(--color-up)' : 'var(--color-down)';

  // Build candle list for K-line chart (merge from dataStore candles or result trades range)
  const chartCandles = candles.map((c) => ({
    date: typeof c.time === 'number'
      ? new Date(c.time * 1000).toISOString().slice(0, 10)
      : String(c.time),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));

  return (
    <div style={overlay}>
      <div style={dialog}>
        <div style={titleStyle}>
          <span>策略回测 — {currentCode} ({currentPeriod})</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Input form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>买入条件（通达信公式）</label>
            <textarea
              value={buyFormula}
              onChange={(e) => setBuyFormula(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={labelStyle}>卖出条件（通达信公式）</label>
            <textarea
              value={sellFormula}
              onChange={(e) => setSellFormula(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <label style={{ ...labelStyle, marginBottom: 0, marginRight: 8, whiteSpace: 'nowrap' }}>初始资金</label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            style={{ ...inputStyle, width: 120 }}
          />
          <div style={{ flex: 1 }} />
          <button style={btnStyle(true)} onClick={() => void run()} disabled={loading}>
            {loading ? '回测中...' : '开始回测'}
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--color-up)', background: 'rgba(255,68,68,0.1)', padding: '6px 10px', borderRadius: 3, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {result && (
          <>
            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <StatCard label="总收益率" value={`${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)}%`} color={totalReturnColor} />
              <StatCard label="最大回撤" value={`-${result.maxDrawdown.toFixed(2)}%`} color="var(--color-up)" />
              <StatCard label="胜率" value={`${result.winRate.toFixed(1)}%`} color={result.winRate >= 50 ? 'var(--color-up)' : 'var(--color-down)'} />
              <StatCard label="Sharpe" value={result.sharpe.toFixed(2)} color={result.sharpe >= 1 ? 'var(--color-up)' : 'var(--text-secondary)'} />
              <StatCard label="交易次数" value={String(result.tradeCount)} />
              <StatCard label="平均持仓" value={`${result.avgHoldDays.toFixed(1)}天`} />
              <StatCard label="盈亏比" value={result.profitFactor >= 999 ? '∞' : result.profitFactor.toFixed(2)} color={result.profitFactor >= 1.5 ? 'var(--color-up)' : 'var(--text-secondary)'} />
            </div>

            {/* K-line with markers */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>K线 + 买卖信号（最近120根）</div>
              <KLineWithMarkers candles={chartCandles} trades={result.trades} />
            </div>

            {/* Equity curve */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>
                资金曲线 — 初始 {result.initialCapital.toLocaleString()} → 最终 {result.finalEquity.toLocaleString()}
                <span style={{ marginLeft: 12 }}>
                  <span style={{ color: 'var(--ma60)' }}>— </span>基准线
                  <span style={{ marginLeft: 8, color: totalReturnColor }}>— </span>策略曲线
                </span>
              </div>
              <EquityCurveChart equityCurve={result.equityCurve} initialCapital={result.initialCapital} />
            </div>

            {/* Trade records table */}
            {result.trades.length > 0 && (
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>交易记录 ({result.trades.length} 笔)</div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 3 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-panel)', position: 'sticky', top: 0 }}>
                        {['买入日期', '卖出日期', '买入价', '卖出价', '盈亏%', '持仓(天)', '方向'].map((h) => (
                          <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 'normal' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => {
                        const isWin = t.pnl_pct > 0;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <td style={{ padding: '3px 8px' }}>{t.entry_date}</td>
                            <td style={{ padding: '3px 8px' }}>{t.exit_date}</td>
                            <td style={{ padding: '3px 8px' }}>{t.entry_price.toFixed(2)}</td>
                            <td style={{ padding: '3px 8px' }}>{t.exit_price.toFixed(2)}</td>
                            <td style={{ padding: '3px 8px', color: isWin ? 'var(--color-up)' : 'var(--color-down)' }}>
                              {isWin ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                            </td>
                            <td style={{ padding: '3px 8px' }}>{t.hold_bars}</td>
                            <td style={{ padding: '3px 8px', color: 'var(--color-up)' }}>{t.direction === 'long' ? '做多' : t.direction}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {result.trades.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                无成交记录 — 请检查公式条件
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
