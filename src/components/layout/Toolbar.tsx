import { useChartStore } from '@/stores/chartStore';

const toolbarStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    padding: '0 12px',
    border: '1px solid var(--border)',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  },
  buttonActive: {
    background: 'var(--color-accent, #e6a23c)',
    color: '#fff',
    borderColor: 'var(--color-accent, #e6a23c)',
  },
};

export function Toolbar() {
  const activeView = useChartStore((s) => s.activeView);
  const setActiveView = useChartStore((s) => s.setActiveView);

  const isMarket = activeView === 'market';

  const handleToggle = () => {
    setActiveView(isMarket ? 'chart' : 'market');
  };

  return (
    <div style={toolbarStyles.container}>
      <button
        style={{
          ...toolbarStyles.button,
          ...(isMarket ? toolbarStyles.buttonActive : {}),
        }}
        onClick={handleToggle}
        title="行情总览 (F6)"
      >
        行情
      </button>
    </div>
  );
}
