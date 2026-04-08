export interface TooltipData {
  symbol: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number;
  amount: number;
  turnover: number;
  amplitude: number;
}

export interface CrosshairPosition {
  x: number;
  y: number;
  barIndex: number;
  time: number;
  price: number;
}
