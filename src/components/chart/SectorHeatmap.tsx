import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useChartStore } from '@/stores/chartStore';

type StockNode = {
  code: string;
  name: string;
  market: 'SH' | 'SZ';
  sector: string;
  close: number;
  change_pct: number;
  volume: number;
  amount: number;
  market_cap: number;
};

type SectorNode = {
  name: string;
  change_pct: number;
  volume: number;
  market_cap: number;
  stock_count: number;
  stocks: StockNode[];
};

type HeatmapResponse = {
  sectors: SectorNode[];
  total_sectors: number;
  total_stocks: number;
};

type AreaMode = 'volume' | 'market_cap';

type Props = { onClose: () => void };

/** Color: red gradient for positive change, green gradient for negative (A-share convention). */
function changeColor(pct: number): string {
  if (Math.abs(pct) < 0.005) return '#555555';
  const intensity = Math.min(Math.abs(pct) / 5, 1); // cap at ±5%
  if (pct > 0) {
    const g = Math.round(68 * (1 - intensity));
    const b = Math.round(68 * (1 - intensity));
    return `rgb(255,${g},${b})`;
  } else {
    const g = Math.round(68 + 136 * intensity);  // 68 → 204
    const b = Math.round(68 + 34 * intensity);   // 68 → 102
    return `rgb(${Math.round(68 * (1 - intensity))},${g},${b})`;
  }
}

type LeafDatum = {
  name: string;
  value: number;
  change_pct: number;
  code?: string;
  market?: 'SH' | 'SZ';
  isStock: boolean;
};

export function SectorHeatmap({ onClose }: Props): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaMode, setAreaMode] = useState<AreaMode>('volume');
  const [selectedSector, setSelectedSector] = useState<SectorNode | null>(null);
  const setCode = useChartStore((s) => s.setCode);
  const setMarket = useChartStore((s) => s.setMarket);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:8899/api/heatmap/sectors')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HeatmapResponse>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, []);

  const handleLeafClick = useCallback(
    (item: LeafDatum, sectors: SectorNode[]) => {
      if (item.isStock) {
        if (item.code && item.market) {
          setCode(item.code);
          setMarket(item.market);
          onClose();
        }
      } else {
        const sector = sectors.find((s) => s.name === item.name);
        if (sector) setSelectedSector(sector);
      }
    },
    [setCode, setMarket, onClose],
  );

  // Build + render D3 treemap whenever data/mode/sector changes
  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return;

    svg.attr('width', width).attr('height', height);

    // Build flat leaf items
    const leaves: LeafDatum[] = selectedSector
      ? selectedSector.stocks.map((s) => ({
          name: s.name,
          code: s.code,
          market: s.market,
          value: areaMode === 'volume' ? s.volume : s.market_cap,
          change_pct: s.change_pct,
          isStock: true,
        }))
      : data.sectors.map((s) => ({
          name: s.name,
          value: areaMode === 'volume' ? s.volume : s.market_cap,
          change_pct: s.change_pct,
          isStock: false,
        }));

    type HierNode = { name: string; children?: LeafDatum[]; value?: number };
    const root = d3
      .hierarchy<HierNode>({ name: 'root', children: leaves as unknown as LeafDatum[] })
      .sum((d) => {
        const ld = d as unknown as LeafDatum;
        return ld.value != null ? Math.max(ld.value, 1) : 0;
      });

    d3
      .treemap<HierNode>()
      .size([width, height])
      .padding(3)
      .round(true)(root);

    type LayoutNode = d3.HierarchyRectangularNode<HierNode> & { data: LeafDatum };

    const cells = svg
      .selectAll<SVGGElement, LayoutNode>('g')
      .data(root.leaves() as LayoutNode[])
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        handleLeafClick(d.data, data.sectors);
      });

    cells
      .append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))
      .attr('fill', (d) => changeColor(d.data.change_pct))
      .attr('stroke', '#000000')
      .attr('stroke-width', 1);

    // Name label
    cells
      .append('text')
      .attr('x', (d) => (d.x1 - d.x0) / 2)
      .attr('y', (d) => (d.y1 - d.y0) / 2 - 7)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', (d) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        return `${Math.min(w / 5, h / 3, 13)}px`;
      })
      .attr('font-family', 'sans-serif')
      .text((d) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        return w < 30 || h < 16 ? '' : d.data.name;
      });

    // Change% label
    cells
      .append('text')
      .attr('x', (d) => (d.x1 - d.x0) / 2)
      .attr('y', (d) => (d.y1 - d.y0) / 2 + 9)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', (d) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        return `${Math.min(w / 6, h / 4, 11)}px`;
      })
      .attr('font-family', 'sans-serif')
      .text((d) => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w < 40 || h < 24) return '';
        const sign = d.data.change_pct >= 0 ? '+' : '';
        return `${sign}${d.data.change_pct.toFixed(2)}%`;
      });
  }, [data, areaMode, selectedSector, handleLeafClick]);

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
    width: '80vw',
    height: '75vh',
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
    gap: 8,
  };

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? 'var(--color-up)' : 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 2,
    color: 'var(--text-primary)',
    fontSize: 11,
    padding: '2px 8px',
    cursor: 'pointer',
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: 13 }}>
            板块热力图
          </span>
          {selectedSector && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>›</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {selectedSector.name}
              </span>
              <button style={btnStyle()} onClick={() => setSelectedSector(null)}>
                返回
              </button>
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, alignSelf: 'center' }}>
              面积：
            </span>
            <button
              style={btnStyle(areaMode === 'volume')}
              onClick={() => setAreaMode('volume')}
            >
              成交量
            </button>
            <button
              style={btnStyle(areaMode === 'market_cap')}
              onClick={() => setAreaMode('market_cap')}
            >
              市值
            </button>
            <button
              style={{ ...btnStyle(), marginLeft: 8 }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Treemap area */}
        <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
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
                position: 'absolute',
                inset: 0,
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
          {!loading && !error && (
            <svg ref={svgRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          )}
        </div>

        {/* Footer legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 12px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {[-5, -3, -1, 0, 1, 3, 5].map((v) => (
            <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  background: changeColor(v),
                  border: '1px solid #333',
                  borderRadius: 2,
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {v >= 0 ? `+${v}%` : `${v}%`}
              </span>
            </div>
          ))}
          {data && !selectedSector && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
              {data.total_sectors} 个板块 · {data.total_stocks} 只股票
            </span>
          )}
          {selectedSector && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11 }}>
              {selectedSector.name} · {selectedSector.stock_count} 只股票 · 点击跳转
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
