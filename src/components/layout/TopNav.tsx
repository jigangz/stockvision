import { useState } from 'react';

const navStyles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    padding: '0 12px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    gap: 8,
    flexShrink: 0,
  },
  stockCode: {
    color: 'var(--text-primary)',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 16,
  },
  periodGroup: {
    display: 'flex',
    gap: 2,
  },
  periodBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    borderRadius: 3,
  },
  periodBtnActive: {
    padding: '4px 10px',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 12,
    borderRadius: 3,
  },
};

const periods = ['1分', '5分', '15分', '30分', '60分', '日K', '周K', '月K'];

export function TopNav() {
  const [activePeriod, setActivePeriod] = useState('日K');

  return (
    <nav style={navStyles.nav}>
      <span style={navStyles.stockCode}>000001 平安银行</span>
      <div style={navStyles.periodGroup}>
        {periods.map((p) => (
          <button
            key={p}
            style={activePeriod === p ? navStyles.periodBtnActive : navStyles.periodBtn}
            onClick={() => setActivePeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </nav>
  );
}
