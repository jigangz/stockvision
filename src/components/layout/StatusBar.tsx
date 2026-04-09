import { useHealthMonitor } from '@/hooks/useHealthMonitor';

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

  return (
    <div style={barStyle}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={dotStyle(connected)} />
        <span>{connected ? 'AKShare' : '未连接'}</span>
      </div>
      <span>StockVision v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</span>
    </div>
  );
}
