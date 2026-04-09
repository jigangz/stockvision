import { registerIndicator } from 'klinecharts';
import type { KLineData } from 'klinecharts';

function registerFSL(): void {
  registerIndicator({
    name: 'FSL',
    shortName: 'FSL',
    calcParams: [10],
    figures: [{ key: 'fsl', title: 'FSL', type: 'line' }],
    calc: (dataList: KLineData[], indicator) => {
      const period = (indicator.calcParams?.[0] as number) ?? 10;
      return dataList.map((_, i) => {
        if (i < period) return {};
        let sum = 0;
        let atrSum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += dataList[j].close;
          atrSum += dataList[j].high - dataList[j].low;
        }
        const sma = sum / period;
        const atr = atrSum / period;
        return { fsl: dataList[i].close > sma ? sma - atr * 0.5 : sma + atr * 0.5 };
      });
    },
  });
}

function registerMOST(): void {
  registerIndicator({
    name: 'MOST',
    shortName: 'MOST',
    calcParams: [20, 3],
    figures: [
      { key: 'most', title: 'MOST', type: 'line' },
      { key: 'exma', title: 'ExMA', type: 'line' },
    ],
    calc: (dataList: KLineData[], indicator) => {
      const period = (indicator.calcParams?.[0] as number) ?? 20;
      const pct = (indicator.calcParams?.[1] as number) ?? 3;
      const multiplier = 2 / (period + 1);
      let ema = dataList[0]?.close ?? 0;
      let most = ema;
      let trend = 1;

      return dataList.map((d, i) => {
        if (i === 0) return { most: d.close, exma: d.close };
        ema = d.close * multiplier + ema * (1 - multiplier);
        const stop = ema * (1 - pct / 100);
        const resist = ema * (1 + pct / 100);
        if (trend === 1) {
          most = Math.max(most, stop);
          if (d.close < most) { trend = -1; most = resist; }
        } else {
          most = Math.min(most, resist);
          if (d.close > most) { trend = 1; most = stop; }
        }
        return { most, exma: ema };
      });
    },
  });
}

function registerASI(): void {
  registerIndicator({
    name: 'ASI',
    shortName: 'ASI',
    calcParams: [],
    figures: [{ key: 'asi', title: 'ASI', type: 'line' }],
    calc: (dataList: KLineData[]) => {
      let asi = 0;
      return dataList.map((d, i) => {
        if (i === 0) return { asi: 0 };
        const prev = dataList[i - 1];
        const h = d.high; const l = d.low; const c = d.close; const o = d.open;
        const pc = prev.close; const po = prev.open;
        const k = Math.max(Math.abs(h - pc), Math.abs(l - pc));
        const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        if (tr === 0) return { asi };
        const er = (Math.abs(h - pc) > Math.abs(l - pc))
          ? Math.abs(h - pc) + 0.5 * Math.abs(l - pc) + 0.25 * Math.abs(pc - po)
          : Math.abs(l - pc) + 0.5 * Math.abs(h - pc) + 0.25 * Math.abs(pc - po);
        const si = er !== 0 ? (50 * (c - pc + 0.5 * (c - o) + 0.25 * (pc - po)) / er * k / tr) : 0;
        asi += si;
        return { asi };
      });
    },
  });
}

function registerBRAR(): void {
  registerIndicator({
    name: 'BRAR',
    shortName: 'BRAR',
    calcParams: [26],
    figures: [
      { key: 'br', title: 'BR', type: 'line' },
      { key: 'ar', title: 'AR', type: 'line' },
    ],
    calc: (dataList: KLineData[], indicator) => {
      const period = (indicator.calcParams?.[0] as number) ?? 26;
      return dataList.map((_, i) => {
        if (i < period) return {};
        let brUp = 0, brDown = 0, arUp = 0, arDown = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const prev = dataList[j - 1];
          brUp += Math.max(0, dataList[j].high - prev.close);
          brDown += Math.max(0, prev.close - dataList[j].low);
          arUp += dataList[j].high - dataList[j].open;
          arDown += dataList[j].open - dataList[j].low;
        }
        return {
          br: brDown !== 0 ? (brUp / brDown) * 100 : 0,
          ar: arDown !== 0 ? (arUp / arDown) * 100 : 0,
        };
      });
    },
  });
}

/**
 * Register all custom indicators with KLineChart.
 * Call once before creating any chart instance.
 */
export function registerCustomIndicators(): void {
  registerFSL();
  registerMOST();
  registerASI();
  registerBRAR();
}
