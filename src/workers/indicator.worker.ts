/// <reference lib="webworker" />

interface CandleInput {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface WorkerRequest {
  candles: CandleInput[];
  indicator: string;
}

interface WorkerResult {
  type: 'result';
  data: { indicator: string; series: unknown[] };
}

interface WorkerError {
  type: 'error';
  message: string;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>): Promise<void> => {
  const { candles, indicator } = event.data;
  try {
    const res = await fetch('http://localhost:8899/api/indicators/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: candles, indicator }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as { indicator: string; series: unknown[] };
    const msg: WorkerResult = { type: 'result', data };
    self.postMessage(msg);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const msg: WorkerError = { type: 'error', message };
    self.postMessage(msg);
  }
};
