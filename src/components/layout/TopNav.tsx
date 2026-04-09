import { PeriodSelector } from '@/components/chart/PeriodSelector';
import { Toolbar } from './Toolbar';
import { useChartStore } from '@/stores/chartStore';
import { useQuotesStore } from '@/stores/quotesStore';

const navStyles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    height: 60,
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
  const currentCode = useChartStore((s) => s.currentCode);
  const quotes = useQuotesStore((s) => s.quotes);
  const quote = quotes.get(currentCode);

  return (
    <nav style={navStyles.nav}>
      <span style={navStyles.stockCode}>{currentCode} {quote?.name || '--'}</span>
      <PeriodSelector />
      <Toolbar />
    </nav>
  );
}
