import type { DeepPartial, ChartOptions } from 'lightweight-charts';

export const darkChartOptions: DeepPartial<ChartOptions> = {
  layout: {
    background: { color: '#000000' },
    textColor: '#CCCCCC',
  },
  grid: {
    vertLines: { color: '#333333', style: 1 },
    horzLines: { color: '#333333', style: 1 },
  },
  crosshair: { mode: 0 },
  rightPriceScale: { borderColor: '#333333' },
  timeScale: {
    borderColor: '#333333',
    rightOffset: 30,
    minBarSpacing: 2,
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: false,
  },
  handleScale: {
    mouseWheel: true,
    pinch: true,
    axisPressedMouseMove: {
      time: true,
      price: false,
    },
  },
};

export const candleColors = {
  upColor: '#FF4444',
  downColor: '#00CC66',
  borderUpColor: '#FF4444',
  borderDownColor: '#00CC66',
  wickUpColor: '#FF4444',
  wickDownColor: '#00CC66',
};

export const maColors = {
  ma5: '#FFFF00',
  ma10: '#FF00FF',
  ma20: '#00FF00',
  ma60: '#FFFFFF',
};

export const volumeColors = {
  up: '#FF4444',
  down: '#00CC66',
};
