import { useState, useEffect } from 'react';
import { useMAStore, MA_COLORS, type MALine } from '@/stores/maStore';

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
  maxWidth: 400,
  color: 'var(--text-primary)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'bold',
  marginBottom: 16,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: 70,
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: 12,
  padding: '3px 6px',
  textAlign: 'right',
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
  background: '#2255BB',
  borderColor: '#2255BB',
};

export function MAConfigDialog() {
  const lines = useMAStore((s) => s.lines);
  const dialogOpen = useMAStore((s) => s.dialogOpen);
  const setLines = useMAStore((s) => s.setLines);
  const closeDialog = useMAStore((s) => s.closeDialog);

  const [draft, setDraft] = useState<MALine[]>(lines);

  // Sync draft when dialog opens
  useEffect(() => {
    if (dialogOpen) setDraft(lines);
  }, [dialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dialogOpen) return null;

  const updateLine = (index: number, updates: Partial<MALine>) => {
    setDraft((prev) => prev.map((l, i) => (i === index ? { ...l, ...updates } : l)));
  };

  const handleApply = () => {
    setLines(draft);
    closeDialog();
  };

  const handleReset = () => {
    const defaults: MALine[] = [
      { period: 5, enabled: true },
      { period: 10, enabled: true },
      { period: 20, enabled: true },
      { period: 60, enabled: true },
      { period: 120, enabled: false },
      { period: 250, enabled: false },
      { period: 0, enabled: false },
      { period: 0, enabled: false },
      { period: 0, enabled: false },
      { period: 0, enabled: false },
    ];
    setDraft(defaults);
  };

  return (
    <div style={overlay} onClick={closeDialog}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>均线设置 (MA)</div>

        {draft.map((line, i) => (
          <div key={i} style={rowStyle}>
            <input
              type="checkbox"
              checked={line.enabled}
              onChange={(e) => updateLine(i, { enabled: e.target.checked })}
            />
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: MA_COLORS[i],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, width: 40, color: 'var(--text-secondary)' }}>
              MA{i + 1}
            </span>
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={line.period || ''}
              placeholder="周期"
              onChange={(e) => updateLine(i, { period: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
        ))}

        <div style={btnRow}>
          <button style={btn} onClick={handleApply}>应用</button>
          <button style={btn} onClick={handleReset}>恢复默认</button>
          <button style={btnPrimary} onClick={closeDialog}>关闭</button>
        </div>
      </div>
    </div>
  );
}
