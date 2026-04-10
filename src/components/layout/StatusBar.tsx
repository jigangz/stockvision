import { useEffect, useState } from 'react';
import { useHealthMonitor } from '@/hooks/useHealthMonitor';

const API = 'http://localhost:8899';

const ADAPTER_LABELS: Record<string, string> = {
  AkshareAdapter: 'AKShare',
  TushareAdapter: 'Tushare',
  TdxAdapter: '通达信',
  MockAdapter: 'Mock',
};

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 28,
  padding: '0 12px',
  background: 'var(--bg-secondary)',
  borderTop: '1px solid var(--border)',
  fontSize: 12,
  color: 'var(--text-muted)',
  flexShrink: 0,
};

const dotStyle = (connected: boolean): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: connected ? 'var(--color-down)' : '#FF4444',
  marginRight: 6,
  display: 'inline-block',
});

export function StatusBar() {
  const { status } = useHealthMonitor();
  const connected = status?.healthy ?? false;
  const [adapterName, setAdapterName] = useState<string>('');

  // Fetch adapter name on connect + listen for adapter-changed event
  useEffect(() => {
    const fetchAdapter = () => {
      fetch(`${API}/api/health`)
        .then((r) => r.json())
        .then((d: { adapter?: string }) => {
          if (d.adapter) setAdapterName(d.adapter);
        })
        .catch(() => undefined);
    };
    fetchAdapter();
    window.addEventListener('adapter-changed', fetchAdapter);
    return () => window.removeEventListener('adapter-changed', fetchAdapter);
  }, [connected]);

  const label = ADAPTER_LABELS[adapterName] ?? adapterName ?? '未知';

  return (
    <div style={barStyle}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={dotStyle(connected)} />
        <span>{connected ? label : '未连接'}</span>
      </div>
      <span>StockVision v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</span>
    </div>
  );
}
