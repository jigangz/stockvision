import { useState } from 'react';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';

interface Props {
  onClose: () => void;
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialog: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '20px 24px',
  minWidth: 320,
  color: 'var(--text-primary)',
};

const title: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'bold',
  marginBottom: 16,
  color: 'var(--text-primary)',
};

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
  gap: 12,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  flexShrink: 0,
};

const input: React.CSSProperties = {
  width: 80,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: 12,
  padding: '3px 6px',
  textAlign: 'right' as const,
};

const btnRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
};

const btn: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 12,
  border: '1px solid var(--border)',
  borderRadius: 2,
  cursor: 'pointer',
  background: 'var(--bg-panel)',
  color: 'var(--text-primary)',
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: '#CC3333',
  borderColor: '#CC3333',
};

export function ChartSettingsDialog({ onClose }: Props) {
  const store = useChartSettingsStore();
  const [rightOffset, setRightOffset] = useState(String(store.rightOffset));
  const [displayDays, setDisplayDays] = useState(String(store.displayDays));

  const handleSave = () => {
    const ro = Math.max(0, Math.min(200, parseInt(rightOffset, 10) || 30));
    const dd = Math.max(10, parseInt(displayDays, 10) || 280);
    store.setRightOffset(ro);
    store.setDisplayDays(dd);
    void store.saveSettings({ rightOffset: ro, displayDays: dd });
    onClose();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={title}>图表设置</div>

        <div style={row}>
          <span style={label}>默认显示天数</span>
          <input
            style={input}
            type="number"
            min={10}
            value={displayDays}
            onChange={(e) => setDisplayDays(e.target.value)}
          />
        </div>

        <div style={row}>
          <span style={label}>右侧空白 (K线数)</span>
          <input
            style={input}
            type="number"
            min={0}
            max={200}
            value={rightOffset}
            onChange={(e) => setRightOffset(e.target.value)}
          />
        </div>

        <div style={btnRow}>
          <button style={btn} onClick={onClose}>取消</button>
          <button style={btnPrimary} onClick={handleSave}>确定</button>
        </div>
      </div>
    </div>
  );
}
