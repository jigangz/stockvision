import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useChartStore } from '@/stores/chartStore';

type FlowCategory = {
  buy_amount: number;
  sell_amount: number;
  net_amount: number;
  buy_volume: number;
  sell_volume: number;
  net_volume: number;
};

type DayFlow = {
  date: string;
  large: FlowCategory;
  medium: FlowCategory;
  small: FlowCategory;
};

type FlowResponse = {
  code: string;
  market: string;
  period: string;
  today: DayFlow | null;
  history: DayFlow[];
};

type Props = { onClose: () => void };

function fmt亿(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}万`;
  return v.toFixed(0);
}

function netColor(v: number): string {
  if (v > 0) return 'var(--color-up)';
  if (v < 0) return 'var(--color-down)';
  return 'var(--color-flat)';
}

const CATEGORIES = [
  { key: 'large' as const, label: '大单(>50万)', color: '#FF4444' },
  { key: 'medium' as const, label: '中单(5-50万)', color: '#FF8800' },
  { key: 'small' as const, label: '小单(<5万)', color: '#00CC66' },
];

function TodayTable({ today }: { today: DayFlow }) {
  const th: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: 11,
    color: 'var(--text-muted)',
    fontWeight: 'normal',
    textAlign: 'right' as const,
    borderBottom: '1px solid var(--border)',
  };
  const td = (v: number, colored = false): React.CSSProperties => ({
    padding: '4px 8px',
    fontSize: 12,
    textAlign: 'right' as const,
    color: colored ? netColor(v) : 'var(--text-primary)',
    borderBottom: '1px solid var(--border)',
  });
  const tdLabel: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: 12,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: 'left' }}>类型</th>
          <th style={th}>买入额</th>
          <th style={th}>卖出额</th>
          <th style={th}>净流入额</th>
          <th style={th}>买入量</th>
          <th style={th}>卖出量</th>
          <th style={th}>净流入量</th>
        </tr>
      </thead>
      <tbody>
        {CATEGORIES.map(({ key, label }) => {
          const cat = today[key];
          return (
            <tr key={key}>
              <td style={tdLabel}>{label}</td>
              <td style={td(cat.buy_amount)}>{fmt亿(cat.buy_amount)}</td>
              <td style={td(cat.sell_amount)}>{fmt亿(cat.sell_amount)}</td>
              <td style={td(cat.net_amount, true)}>{fmt亿(cat.net_amount)}</td>
              <td style={td(cat.buy_volume)}>{fmt亿(cat.buy_volume)}</td>
              <td style={td(cat.sell_volume)}>{fmt亿(cat.sell_volume)}</td>
              <td style={td(cat.net_volume, true)}>{fmt亿(cat.net_volume)}</td>
            </tr>
          );
        })}
        {/* Main force summary = large net */}
        <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
          <td style={{ ...tdLabel, color: 'var(--text-primary)', fontWeight: 'bold' }}>
            主力净流入
          </td>
          <td colSpan={2} style={{ ...td(0), color: 'var(--text-muted)', fontSize: 11 }}>
            （大单合计）
          </td>
          <td style={td(today.large.net_amount, true)}>
            {fmt亿(today.large.net_amount)}
          </td>
          <td colSpan={2} style={{ ...td(0) }} />
          <td style={td(today.large.net_volume, true)}>
            {fmt亿(today.large.net_volume)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function HistoryChart({ history }: { history: DayFlow[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !history.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect = containerRef.current.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    if (W <= 0 || H <= 0) return;

    const margin = { top: 10, right: 60, bottom: 30, left: 60 };
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    svg.attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale: categorical by date
    const dates = history.map((d) => d.date);
    const x = d3.scaleBand().domain(dates).range([0, w]).padding(0.15);

    // Y scale: net_amount of all categories combined
    const allNets = history.flatMap((d) => [
      d.large.net_amount,
      d.medium.net_amount,
      d.small.net_amount,
    ]);
    const yMin = d3.min(allNets) ?? 0;
    const yMax = d3.max(allNets) ?? 0;
    const yPad = Math.max(Math.abs(yMax - yMin) * 0.1, 1);
    const y = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([h, 0]).nice();

    // Zero line
    const zero = y(0);
    g.append('line')
      .attr('x1', 0)
      .attr('x2', w)
      .attr('y1', zero)
      .attr('y2', zero)
      .attr('stroke', 'var(--grid-line)')
      .attr('stroke-dasharray', '4,4');

    // Y axis
    g.append('g')
      .call(
        d3.axisLeft(y)
          .ticks(4)
          .tickFormat((v) => fmt亿(v as number)),
      )
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', 9);
    g.selectAll('.domain,.tick line').attr('stroke', 'var(--grid-line)');

    // X axis (show only every N-th label to avoid crowding)
    const step = Math.ceil(dates.length / 8);
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(
        d3.axisBottom(x).tickValues(dates.filter((_, i) => i % step === 0)),
      )
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', 9)
      .attr('transform', 'rotate(-30)')
      .style('text-anchor', 'end');
    g.selectAll('.domain').attr('stroke', 'var(--grid-line)');

    // Bars for each category (grouped within each date slot)
    const subW = (x.bandwidth() / 3);
    CATEGORIES.forEach(({ key, color }, ci) => {
      history.forEach((d) => {
        const val = d[key].net_amount;
        const bx = (x(d.date) ?? 0) + ci * subW;
        const yTop = val >= 0 ? y(val) : zero;
        const bh = Math.abs(y(val) - zero);
        g.append('rect')
          .attr('x', bx)
          .attr('y', yTop)
          .attr('width', subW)
          .attr('height', Math.max(1, bh))
          .attr('fill', val >= 0 ? color : color + '88')
          .attr('opacity', 0.85);
      });
    });

    // Legend
    const legendG = svg.append('g').attr('transform', `translate(${W - margin.right + 4},${margin.top})`);
    CATEGORIES.forEach(({ label, color }, i) => {
      const row = legendG.append('g').attr('transform', `translate(0,${i * 18})`);
      row.append('rect').attr('width', 10).attr('height', 10).attr('fill', color).attr('y', 1);
      row.append('text')
        .attr('x', 13)
        .attr('y', 10)
        .attr('fill', 'var(--text-muted)')
        .attr('font-size', 9)
        .text(label.split('(')[0]);
    });
  }, [history]);

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
      <svg ref={svgRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

export function CapitalFlowDialog({ onClose }: Props): React.ReactElement {
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);
  const currentPeriod = useChartStore((s) => s.currentPeriod);

  const [data, setData] = useState<FlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url =
      `http://localhost:8899/api/capital_flow` +
      `?code=${currentCode}&market=${currentMarket}&period=${currentPeriod}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FlowResponse>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [currentCode, currentMarket, currentPeriod]);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const dialogStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    width: '72vw',
    height: '70vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  };

  const sectionLabelStyle: React.CSSProperties = {
    color: 'var(--text-muted)',
    fontSize: 11,
    padding: '4px 12px 2px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    background: 'rgba(255,255,255,0.02)',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: 13 }}>
            资金流向 — {currentCode}
          </span>
          <button
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 2,
              color: 'var(--text-primary)',
              fontSize: 11,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {loading && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            加载中…
          </div>
        )}
        {error && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-up)',
              fontSize: 13,
            }}
          >
            加载失败：{error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Top: today's breakdown */}
            <div style={sectionLabelStyle}>今日资金流向概览（主力 vs 散户）</div>
            <div style={{ flexShrink: 0, overflowX: 'auto', padding: '4px 0' }}>
              {data.today ? (
                <TodayTable today={data.today} />
              ) : (
                <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                  暂无今日数据
                </div>
              )}
            </div>

            {/* Bottom: historical trend */}
            <div style={sectionLabelStyle}>历史资金流向趋势（近30交易日，净流入额）</div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 4 }}>
              <HistoryChart history={data.history} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
