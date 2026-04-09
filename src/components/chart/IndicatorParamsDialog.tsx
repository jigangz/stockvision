import { useState } from 'react';
import {
  INDICATOR_DEFAULTS,
  PARAM_LABELS,
  useIndicatorStore,
  type IndicatorType,
} from '@/stores/indicatorStore';

interface Props {
  indicator: IndicatorType;
  onClose: () => void;
}

// ── Styles (matches ChartSettingsDialog dark theme) ─────────────────────────

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
  minWidth: 280,
  maxWidth: 360,
  color: 'var(--text-primary)',
};

const titleStyle: React.CSSProperties = {
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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
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

export function IndicatorParamsDialog({ indicator, onClose }: Props) {
  const defaults = INDICATOR_DEFAULTS[indicator];
  const storedParams = useIndicatorStore((s) => s.indicatorParams[indicator]);
  const setParams = useIndicatorStore((s) => s.setParams);
  const resetParams = useIndicatorStore((s) => s.resetParams);

  // No tuneable params for this indicator
  if (!defaults || Object.keys(defaults).length === 0) {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={dialog} onClick={(e) => e.stopPropagation()}>
          <div style={titleStyle}>{indicator} 参数设置</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            该指标没有可调参数
          </div>
          <div style={btnRow}>
            <button style={btn} onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  const initial: Record<string, string> = {};
  for (const key of Object.keys(defaults)) {
    initial[key] = String(storedParams?.[key] ?? defaults[key]);
  }

  return <IndicatorParamsForm indicator={indicator} defaults={defaults} initial={initial} setParams={setParams} resetParams={resetParams} onClose={onClose} />;
}

// Separate component so useState doesn't re-init on store changes
function IndicatorParamsForm({
  indicator,
  defaults,
  initial,
  setParams,
  resetParams,
  onClose,
}: {
  indicator: string;
  defaults: Record<string, number>;
  initial: Record<string, string>;
  setParams: (ind: string, p: Record<string, number>) => void;
  resetParams: (ind: string) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);

  const handleConfirm = () => {
    const parsed: Record<string, number> = {};
    for (const [key, val] of Object.entries(values)) {
      const num = parseFloat(val);
      parsed[key] = isNaN(num) ? defaults[key] : num;
    }
    setParams(indicator, parsed);
    onClose();
  };

  const handleReset = () => {
    const reset: Record<string, string> = {};
    for (const key of Object.keys(defaults)) {
      reset[key] = String(defaults[key]);
    }
    setValues(reset);
    resetParams(indicator);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>{indicator} 参数设置</div>

        {Object.keys(defaults).map((key) => (
          <div key={key} style={row}>
            <span style={labelStyle}>{PARAM_LABELS[key] ?? key}</span>
            <input
              style={inputStyle}
              type="number"
              step={defaults[key] < 1 ? 0.01 : 1}
              value={values[key] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          </div>
        ))}

        <div style={btnRow}>
          <button style={btn} onClick={handleReset}>重置</button>
          <button style={btn} onClick={onClose}>取消</button>
          <button style={btnPrimary} onClick={handleConfirm}>确定</button>
        </div>
      </div>
    </div>
  );
}
