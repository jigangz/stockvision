/**
 * Maps StockVision DrawingToolType → KLineChart overlay name.
 * Built-in overlays use KLineChart's registered name directly.
 * Custom overlays use our registered prefix 'sv_'.
 */
export const OVERLAY_MAP: Record<string, string> = {
  // Lines — KLineChart built-in
  trendline: 'straightLine',
  ray: 'rayLine',
  segment: 'segment',
  horizontal: 'horizontalStraightLine',
  vertical: 'verticalStraightLine',
  parallel_line: 'parallelStraightLine',
  price_line: 'priceLine',

  // Channels — KLineChart built-in
  channel: 'priceChannelLine',

  // Fibonacci — KLineChart built-in
  fibRetracement: 'fibonacciLine',

  // Shapes — KLineChart built-in
  rectangle: 'rect',
  triangle: 'polygon',
  text: 'simpleAnnotation',

  // Custom overlays (registered with 'sv_' prefix)
  arrow: 'sv_arrow',
  arc: 'sv_arc',
  ellipse: 'sv_ellipse',
  pitchfork: 'sv_pitchfork',
  regressionChannel: 'sv_regressionChannel',
  fibExtension: 'sv_fibExtension',
  fib_fan: 'sv_fibFan',
  fib_arc: 'sv_fibArc',
  fib_timezone: 'sv_fibTimezone',
  gannAngle: 'sv_gannAngle',
  gannFan: 'sv_gannFan',
  gannGrid: 'sv_gannGrid',
  gannSquare: 'sv_gannSquare',
  speedResistance: 'sv_speedResistance',
  percentLine: 'sv_percentLine',
  cycleLine: 'sv_cycleLine',
  measure: 'sv_measure',
  buyMark: 'sv_buyMark',
  sellMark: 'sv_sellMark',
  flatMark: 'sv_flatMark',
};

/**
 * Get the KLineChart overlay name for a given DrawingToolType.
 * Falls back to the type itself if not mapped.
 */
export function getOverlayName(toolType: string): string {
  return OVERLAY_MAP[toolType] ?? toolType;
}
