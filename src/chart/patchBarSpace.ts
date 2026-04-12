import type { Chart } from 'klinecharts';

/**
 * Monkey-patch a KLineChart instance to allow sub-pixel barSpace.
 *
 * KLineChart hardcodes BarSpaceLimitConstants.MIN = 1, so setBarSpace()
 * silently rejects anything below 1 px.  TDX / HQChart can render 8 000+
 * daily bars on a single screen (≈ 0.1 px per bar) — we need the same.
 *
 * Call once after `init()`.
 */
export function patchSubPixelZoom(chart: Chart): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = chart as any;
  const tsStore = c._chartStore?.getTimeScaleStore?.();
  if (!tsStore) return;

  // --- 1. _calcGapBarSpace: handle barSpace < 1 --------------------------
  const origCalcGap = tsStore._calcGapBarSpace.bind(tsStore);
  tsStore._calcGapBarSpace = function () {
    if (this._barSpace < 1) return this._barSpace;   // entire width = candle
    return origCalcGap();
  };

  // --- 2. getBarSpace: don't Math.floor halfGapBar when sub-pixel ---------
  tsStore.getBarSpace = function () {
    const sub = this._barSpace < 1;
    return {
      bar: this._barSpace,
      halfBar: this._barSpace / 2,
      gapBar: this._gapBarSpace,
      halfGapBar: sub ? this._gapBarSpace / 2 : Math.floor(this._gapBarSpace / 2),
    };
  };

  // --- 3. setBarSpace: lower MIN from 1 → 0.01 ---------------------------
  tsStore.setBarSpace = function (
    barSpace: number,
    adjustBeforeFunc?: () => void,
  ) {
    if (barSpace < 0.01 || barSpace > 50 || this._barSpace === barSpace) return;
    this._barSpace = barSpace;
    this._gapBarSpace = this._calcGapBarSpace();
    adjustBeforeFunc?.();
    this.adjustVisibleRange();
    this._chartStore.getTooltipStore().recalculateCrosshair(true);
    this._chartStore.getChart().adjustPaneViewport(false, true, true, true);
  };
}

/**
 * After extreme zoom-out where all data fits on screen, remove the left gap
 * by setting _lastBarRightSideDiffBarCount so bar-0 aligns to the left edge.
 */
export function scrollFitAll(chart: Chart): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = chart as any;
  const tsStore = c._chartStore?.getTimeScaleStore?.();
  if (!tsStore) return;

  const totalBars = c._chartStore.getDataList().length;
  const barSpace: number = tsStore._barSpace;
  const totalBarSpace: number = tsStore._totalBarSpace; // chart pixel width
  const visibleBarCount = totalBarSpace / barSpace;

  // All data fits → anchor first bar at left edge
  if (totalBars <= visibleBarCount) {
    // _lastBarRightSideDiffBarCount = how many "extra bar slots" after the
    // last data bar.  Setting it to (visibleBarCount - totalBars) puts
    // bar-0 at the left edge and bar-N at `totalBars * barSpace` from left.
    tsStore._lastBarRightSideDiffBarCount = visibleBarCount - totalBars;
    tsStore.adjustVisibleRange();
    c._chartStore.getTooltipStore().recalculateCrosshair(true);
    c.adjustPaneViewport(false, true, true, true);
  }
}
