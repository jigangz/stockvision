import { useChartStore } from '@/stores/chartStore';

export type Period =
  | '1m' | '5m' | '15m' | '30m' | '60m'
  | 'daily' | 'weekly' | 'monthly'
  | 'quarterly' | 'yearly' | 'multi_year';

interface PeriodOption {
  label: string;
  value: Period;
}

const minuteGroup: PeriodOption[] = [
  { label: '1分', value: '1m' },
  { label: '5分', value: '5m' },
  { label: '15分', value: '15m' },
  { label: '30分', value: '30m' },
  { label: '60分', value: '60m' },
];

const dayGroup: PeriodOption[] = [
  { label: '日', value: 'daily' },
  { label: '周', value: 'weekly' },
  { label: '月', value: 'monthly' },
];

const longGroup: PeriodOption[] = [
  { label: '季', value: 'quarterly' },
  { label: '年', value: 'yearly' },
  { label: '多年', value: 'multi_year' },
];

const groups = [minuteGroup, dayGroup, longGroup];

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  separator: {
    width: 1,
    height: 16,
    background: 'var(--border, #333)',
    margin: '0 6px',
    flexShrink: 0,
  },
  btn: {
    padding: '3px 8px',
    border: 'none',
    borderRadius: 3,
    fontSize: 12,
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--text-primary, #FFFFFF)',
    lineHeight: 1.4,
    whiteSpace: 'nowrap' as const,
  },
  btnActive: {
    padding: '3px 8px',
    border: 'none',
    borderRadius: 3,
    fontSize: 12,
    cursor: 'pointer',
    background: 'var(--bg-secondary, #1A1A2E)',
    color: 'var(--text-primary, #FFFFFF)',
    lineHeight: 1.4,
    whiteSpace: 'nowrap' as const,
  },
};

export function PeriodSelector() {
  const currentPeriod = useChartStore((s) => s.currentPeriod);
  const setPeriod = useChartStore((s) => s.setPeriod);

  const handleClick = (period: Period) => {
    setPeriod(period);
  };

  return (
    <div style={styles.container}>
      {groups.map((group, gi) => (
        <div key={gi} style={{ display: 'flex', alignItems: 'center' }}>
          {gi > 0 && <div style={styles.separator} />}
          {group.map((opt) => (
            <button
              key={opt.value}
              style={currentPeriod === opt.value ? styles.btnActive : styles.btn}
              onClick={() => handleClick(opt.value)}
              onMouseEnter={(e) => {
                if (currentPeriod !== opt.value) {
                  e.currentTarget.style.color = 'var(--text-secondary, #CCCCCC)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-primary, #FFFFFF)';
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
