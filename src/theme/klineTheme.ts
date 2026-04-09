/**
 * KLineChart dark theme styles (replaces LW Charts darkTheme.ts).
 * Uses CSS variable values directly since KLineChart doesn't support CSS vars.
 */
export const darkStyles: Record<string, unknown> = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: '#333333',
      style: 'dashed',
      dashedValue: [2, 2],
    },
    vertical: {
      show: true,
      size: 1,
      color: '#333333',
      style: 'dashed',
      dashedValue: [2, 2],
    },
  },
  candle: {
    type: 'candle_solid',
    bar: {
      upColor: '#FF4444',
      downColor: '#00CC66',
      noChangeColor: '#888888',
      upBorderColor: '#FF4444',
      downBorderColor: '#00CC66',
      noChangeBorderColor: '#888888',
      upWickColor: '#FF4444',
      downWickColor: '#00CC66',
      noChangeWickColor: '#888888',
    },
    priceMark: {
      show: true,
      high: { show: true, color: '#FF4444', textSize: 10 },
      low: { show: true, color: '#00CC66', textSize: 10 },
      last: {
        show: true,
        upColor: '#FF4444',
        downColor: '#00CC66',
        noChangeColor: '#888888',
        line: { show: true, style: 'dashed', dashedValue: [4, 4], size: 1 },
        text: { show: true, size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
      },
    },
    tooltip: {
      showRule: 'always',
      showType: 'rect',
      custom: [
        { title: '时间', value: '{time}' },
        { title: '开', value: '{open}' },
        { title: '高', value: '{high}' },
        { title: '低', value: '{low}' },
        { title: '收', value: '{close}' },
        { title: '量', value: '{volume}' },
      ],
      rect: {
        position: 'pointer',
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
        offsetLeft: 16,
        offsetTop: 16,
        offsetRight: 16,
        offsetBottom: 16,
        borderRadius: 4,
        borderSize: 1,
        borderColor: '#555555',
        color: 'rgba(25, 25, 25, 0.92)',
      },
      text: { size: 11, color: '#CCCCCC' },
    },
  },
  indicator: {
    lastValueMark: { show: false },
    tooltip: {
      showRule: 'always',
      showName: true,
      showParams: true,
      showValue: true,
      text: { size: 11 },
    },
    lines: [
      { color: '#FFFF00', size: 1, style: 'solid', smooth: false }, // MA5 / line 1
      { color: '#FF00FF', size: 1, style: 'solid', smooth: false }, // MA10 / line 2
      { color: '#00FF00', size: 1, style: 'solid', smooth: false }, // MA20 / line 3
      { color: '#FFFFFF', size: 1, style: 'solid', smooth: false }, // MA60 / line 4
      { color: '#FF8800', size: 1, style: 'solid', smooth: false }, // line 5
      { color: '#00CCFF', size: 1, style: 'solid', smooth: false }, // line 6
    ],
  },
  xAxis: {
    show: true,
    size: 'auto',
    axisLine: { show: true, color: '#555555', size: 1 },
    tickLine: { show: true, size: 1, length: 3, color: '#555555' },
    tickText: { show: true, color: '#CCCCCC', size: 10 },
  },
  yAxis: {
    show: true,
    size: 'auto',
    position: 'right',
    type: 'normal',
    axisLine: { show: true, color: '#333333', size: 1 },
    tickLine: { show: true, size: 1, length: 3, color: '#333333' },
    tickText: { show: true, color: '#CCCCCC', size: 10 },
  },
  separator: {
    size: 2,
    color: '#444444',
    activeBackgroundColor: 'rgba(255,255,255,0.1)',
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#888888' },
      text: { show: true, color: '#000000', borderColor: '#888888', backgroundColor: '#CCCCCC', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
    },
    vertical: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#888888' },
      text: { show: true, color: '#000000', borderColor: '#888888', backgroundColor: '#CCCCCC', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
    },
  },
  overlay: {
    point: { color: '#FFFFFF', borderColor: '#FFFFFF', borderSize: 1, radius: 4, activeColor: '#FFFF00', activeBorderColor: '#FFFF00', activeBorderSize: 1, activeRadius: 6 },
    line: { style: 'solid', color: '#FFFFFF', size: 1, smooth: false },
    rect: { style: 'stroke', color: 'rgba(255,255,255,0.2)', borderColor: '#FFFFFF', borderSize: 1, borderStyle: 'solid', borderRadius: 0 },
    text: { color: '#FFFFFF', size: 12, family: 'monospace', weight: 'normal' },
  },
};

/** MA indicator line colors (for reference in custom code) */
export const MA_COLORS = {
  ma5: '#FFFF00',
  ma10: '#FF00FF',
  ma20: '#00FF00',
  ma60: '#FFFFFF',
};

/** Volume up/down colors */
export const VOLUME_COLORS = {
  up: '#FF4444',
  down: '#00CC66',
};
