import React from 'react';
import { useDrawingStore } from '@/stores/drawingStore';
import type { DrawingToolType } from '@/stores/drawingStore';

interface ToolDef {
  type: DrawingToolType;
  icon: string;
  tooltip: string;
}

const TOOLS: ToolDef[] = [
  { type: 'trendline',      icon: '↗',   tooltip: '趋势线' },
  { type: 'ray',            icon: '→',   tooltip: '射线' },
  { type: 'segment',        icon: '—',   tooltip: '线段' },
  { type: 'horizontal',     icon: '━',   tooltip: '水平线' },
  { type: 'vertical',       icon: '┃',   tooltip: '垂直线' },
  { type: 'channel',        icon: '⊟',   tooltip: '平行通道' },
  { type: 'parallel_line',  icon: '∥',   tooltip: '平行线' },
  { type: 'price_line',     icon: '─P',  tooltip: '价格线' },
  { type: 'arrow',          icon: '➜',   tooltip: '箭头' },
  { type: 'arc',            icon: '⌒',   tooltip: '弧线' },
  { type: 'fibRetracement', icon: 'Fib', tooltip: '斐波那契' },
  { type: 'fib_fan',        icon: 'F⇗',  tooltip: '斐波扇形' },
  { type: 'fib_arc',        icon: 'F○',  tooltip: '斐波弧线' },
  { type: 'fib_timezone',   icon: 'F|',  tooltip: '斐波时间带' },
  { type: 'gannAngle',      icon: 'G°',  tooltip: '甘氏角' },
  { type: 'rectangle',      icon: '□',   tooltip: '矩形' },
  { type: 'text',           icon: 'T',   tooltip: '文字' },
  { type: 'buyMark',        icon: '▲',   tooltip: '买入标记' },
  { type: 'sellMark',       icon: '▼',   tooltip: '卖出标记' },
  { type: 'flatMark',       icon: '●',   tooltip: '持平标记' },
];

const LINE_STYLES = [
  { value: 'solid'  as const, label: '─',  tooltip: '实线' },
  { value: 'dashed' as const, label: '╌',  tooltip: '虚线' },
  { value: 'dotted' as const, label: '…',  tooltip: '点线' },
];

const LINE_WIDTHS = [1, 2, 3, 4, 5] as const;

function toolBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--color-up)' : 'transparent',
    border: '1px solid ' + (active ? 'var(--color-up)' : 'var(--border)'),
    borderRadius: 2,
    color: active ? '#fff' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 5px',
    minWidth: 26,
    textAlign: 'center',
    lineHeight: '16px',
  };
}

function smallBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--color-up)' : 'transparent',
    border: '1px solid ' + (active ? 'var(--color-up)' : 'var(--border)'),
    borderRadius: 2,
    color: active ? '#fff' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 10,
    padding: '1px 5px',
    minWidth: 22,
    textAlign: 'center',
    lineHeight: '14px',
  };
}

export function DrawingToolbar(): React.ReactElement {
  const activeTool  = useDrawingStore((s) => s.activeTool);
  const activeStyle = useDrawingStore((s) => s.activeStyle);
  const setActiveTool  = useDrawingStore((s) => s.setActiveTool);
  const setActiveStyle = useDrawingStore((s) => s.setActiveStyle);

  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        left: 4,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '6px 6px 4px',
        zIndex: 100,
        userSelect: 'none',
      }}
    >
      {/* Cursor / cancel button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <button
          title="取消画线 (Esc)"
          onClick={() => setActiveTool(null)}
          style={toolBtn(activeTool === null)}
        >
          ↖
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>画线工具</span>
      </div>

      {/* Tool grid — 7 columns × 2 rows */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
        }}
      >
        {TOOLS.map((t) => (
          <button
            key={t.type}
            title={t.tooltip}
            onClick={() => setActiveTool(activeTool === t.type ? null : t.type)}
            style={toolBtn(activeTool === t.type)}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Style controls */}
      <div
        style={{
          marginTop: 6,
          borderTop: '1px solid var(--border)',
          paddingTop: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Color picker row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 14 }}>色</span>
          <input
            type="color"
            value={activeStyle.color}
            title="线条颜色"
            onChange={(e) => setActiveStyle({ color: e.target.value })}
            style={{
              width: 22,
              height: 16,
              border: '1px solid var(--border)',
              padding: 0,
              cursor: 'pointer',
              background: 'none',
              borderRadius: 2,
            }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{activeStyle.color}</span>
        </div>

        {/* Line style row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 14 }}>型</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {LINE_STYLES.map((ls) => (
              <button
                key={ls.value}
                title={ls.tooltip}
                onClick={() => setActiveStyle({ lineStyle: ls.value })}
                style={smallBtn(activeStyle.lineStyle === ls.value)}
              >
                {ls.label}
              </button>
            ))}
          </div>
        </div>

        {/* Line width row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 14 }}>粗</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {LINE_WIDTHS.map((w) => (
              <button
                key={w}
                title={`${w}px`}
                onClick={() => setActiveStyle({ lineWidth: w })}
                style={smallBtn(activeStyle.lineWidth === w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
