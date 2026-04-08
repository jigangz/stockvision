import { useState, useRef, useEffect } from 'react';
import { useChartStore } from '@/stores/chartStore';

interface Props {
  onClose: () => void;
}

export function StockCodeInput({ onClose }: Props): React.ReactElement {
  const [code, setCode] = useState('');
  const [market, setMarket] = useState<'SH' | 'SZ'>('SH');
  const inputRef = useRef<HTMLInputElement>(null);
  const setCode_ = useChartStore((s) => s.setCode);
  const setMarket_ = useChartStore((s) => s.setMarket);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    const trimmed = code.trim();
    if (!trimmed) { onClose(); return; }
    setCode_(trimmed);
    setMarket_(market);
    onClose();
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const boxStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 280,
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-primary)',
    fontSize: 13,
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 2,
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '4px 8px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 4,
  };

  const btnStyle = (primary: boolean): React.CSSProperties => ({
    background: primary ? 'var(--color-up)' : 'transparent',
    border: `1px solid ${primary ? 'var(--color-up)' : 'var(--border)'}`,
    borderRadius: 2,
    color: 'var(--text-primary)',
    fontSize: 12,
    padding: '4px 12px',
    cursor: 'pointer',
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={labelStyle}>输入股票代码</div>
        <input
          ref={inputRef}
          style={inputStyle}
          value={code}
          placeholder="如 000001"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') onClose();
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {(['SH', 'SZ'] as const).map((m) => (
            <button
              key={m}
              style={{
                ...btnStyle(market === m),
                flex: 1,
              }}
              onClick={() => setMarket(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <div style={rowStyle}>
          <button style={btnStyle(false)} onClick={onClose}>取消</button>
          <button style={btnStyle(true)} onClick={handleConfirm}>确认</button>
        </div>
      </div>
    </div>
  );
}
