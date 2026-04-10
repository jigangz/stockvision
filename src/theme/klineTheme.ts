/**
 * KLineChart 通达信蓝色主题 styles.
 */
export const darkStyles: Record<string, unknown> = {
  grid: {
    show: true,
    horizontal: {
      show: false,
    },
    vertical: {
      show: false,
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
        borderColor: '#2A3A6E',
        color: 'rgba(6, 12, 48, 0.94)',
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
      { color: '#FFFF00', size: 1, style: 'solid', smooth: false }, // MA1 yellow
      { color: '#FF00FF', size: 1, style: 'solid', smooth: false }, // MA2 magenta
      { color: '#00FF00', size: 1, style: 'solid', smooth: false }, // MA3 green
      { color: '#FFFFFF', size: 1, style: 'solid', smooth: false }, // MA4 white
      { color: '#FF8800', size: 1, style: 'solid', smooth: false }, // MA5 orange
      { color: '#00CCFF', size: 1, style: 'solid', smooth: false }, // MA6 cyan
      { color: '#FF6688', size: 1, style: 'solid', smooth: false }, // MA7 pink
      { color: '#88FF88', size: 1, style: 'solid', smooth: false }, // MA8 light green
      { color: '#8888FF', size: 1, style: 'solid', smooth: false }, // MA9 light blue
      { color: '#FFAA44', size: 1, style: 'solid', smooth: false }, // MA10 gold
    ],
  },
  xAxis: {
    show: true,
    size: 'auto',
    axisLine: { show: true, color: '#1E2D5A', size: 1 },
    tickLine: { show: true, size: 1, length: 3, color: '#1E2D5A' },
    tickText: { show: true, color: '#7788AA', size: 10 },
  },
  yAxis: {
    show: true,
    size: 'auto',
    position: 'right',
    type: 'normal',
    axisLine: { show: true, color: '#1E2D5A', size: 1 },
    tickLine: { show: true, size: 1, length: 3, color: '#1E2D5A' },
    tickText: { show: true, color: '#7788AA', size: 10 },
  },
  separator: {
    size: 2,
    color: '#1E2D5A',
    activeBackgroundColor: 'rgba(100,140,255,0.15)',
  },
  crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#5566AA' },
      text: { show: true, color: '#FFFFFF', borderColor: '#3355AA', backgroundColor: '#1A2D6E', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
    },
    vertical: {
      show: true,
      line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: '#5566AA' },
      text: { show: true, color: '#FFFFFF', borderColor: '#3355AA', backgroundColor: '#1A2D6E', size: 10, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 },
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
export const MA_COLORS = [
  '#FFFF00', '#FF00FF', '#00FF00', '#FFFFFF', '#FF8800',
  '#00CCFF', '#FF6688', '#88FF88', '#8888FF', '#FFAA44',
];

/** Volume up/down colors */
export const VOLUME_COLORS = {
  up: '#FF4444',
  down: '#00CC66',
};
