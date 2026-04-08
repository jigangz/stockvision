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
  minWidth: 300,
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

const inputStyle: React.CSSProperties = {
  width: 100,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: 12,
  padding: '3px 6px',
  textAlign: 'right' as const,
};

const radioRow: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  marginBottom: 12,
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

export function PriceScaleDialog({ onClose }: Props) {
  const store = useChartSettingsStore();
  const [mode, setMode] = useState<'auto' | 'manual'>(store.priceScaleMode);
  const [priceMin, setPriceMin] = useState(store.priceMin != null ? String(store.priceMin) : '');
  const [priceMax, setPriceMax] = useState(store.priceMax != null ? String(store.priceMax) : '');

  const handleSave = () => {
    if (mode === 'auto') {
      store.setPriceScale('auto', null, null);
      void store.saveSettings({ priceScaleMode: 'auto', priceMin: null, priceMax: null });
    } else {
      const min = parseFloat(priceMin) || null;
      const max = parseFloat(priceMax) || null;
      store.setPriceScale('manual', min, max);
      void store.saveSettings({ priceScaleMode: 'manual', priceMin: min, priceMax: max });
    }
    onClose();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={title}>坐标设置</div>

        <div style={radioRow}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={mode === 'auto'}
              onChange={() => setMode('auto')}
              style={{ marginRight: 4 }}
            />
            自动
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
              style={{ marginRight: 4 }}
            />
            手动
          </label>
        </div>

        <div style={{ ...row, opacity: mode === 'manual' ? 1 : 0.4 }}>
          <span style={label}>最低价</span>
          <input
            style={inputStyle}
            type="number"
            step="0.01"
            value={priceMin}
            disabled={mode === 'auto'}
            onChange={(e) => setPriceMin(e.target.value)}
          />
        </div>

        <div style={{ ...row, opacity: mode === 'manual' ? 1 : 0.4 }}>
          <span style={label}>最高价</span>
          <input
            style={inputStyle}
            type="number"
            step="0.01"
            value={priceMax}
            disabled={mode === 'auto'}
            onChange={(e) => setPriceMax(e.target.value)}
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
