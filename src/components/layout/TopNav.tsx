import { PeriodSelector } from '@/components/chart/PeriodSelector';

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
};

export function TopNav() {
  return (
    <nav style={navStyles.nav}>
      <span style={navStyles.stockCode}>000001 平安银行</span>
      <PeriodSelector />
    </nav>
  );
}
