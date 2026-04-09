import { useEffect, useRef, useCallback, useState } from 'react';

const API_BASE = 'http://localhost:8899';
const POLL_INTERVAL = 30_000; // 30s

export interface HealthStatus {
  healthy: boolean;
  consecutive_failures: number;
  last_error: string | null;
  last_error_time: number | null;
  last_error_source: string | null;
  last_success: number | null;
}

/**
 * Polls /api/health/status every 30s.
 * Returns current health status + dismiss/clear functions.
 */
export function useHealthMonitor() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health/status`);
      if (res.ok) {
        const data = (await res.json()) as HealthStatus;
        setStatus(data);
        // Auto-reset dismissed when things recover
        if (data.healthy) setDismissed(false);
      }
    } catch {
      // Backend itself is down — that's a different problem
      setStatus({
        healthy: false,
        consecutive_failures: 99,
        last_error: '后端服务未响应',
        last_error_time: Date.now() / 1000,
        last_error_source: 'backend',
        last_success: null,
      });
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    timerRef.current = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchStatus]);

  const dismiss = useCallback(async () => {
    setDismissed(true);
    try {
      await fetch(`${API_BASE}/api/health/clear`, { method: 'POST' });
    } catch { /* ignore */ }
  }, []);

  return {
    status,
    showWarning: status !== null && !status.healthy && !dismissed,
    dismiss,
  };
}
