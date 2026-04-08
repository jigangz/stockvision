import { ALL_INDICATORS, type IndicatorType, useIndicatorStore } from '@/stores/indicatorStore';

export function IndicatorTabBar(): React.ReactElement {
  const activeIndicator = useIndicatorStore((s) => s.activeIndicator);
  const setActiveIndicator = useIndicatorStore((s) => s.setActiveIndicator);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        alignItems: 'center',
        height: 22,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        scrollbarWidth: 'none',
      }}
    >
      {ALL_INDICATORS.map((ind: IndicatorType) => (
        <button
          key={ind}
          onClick={() => setActiveIndicator(ind)}
          style={{
            flexShrink: 0,
            background: activeIndicator === ind ? 'var(--bg-panel)' : 'transparent',
            border: 'none',
            borderBottom: activeIndicator === ind ? '2px solid var(--color-up)' : '2px solid transparent',
            color: activeIndicator === ind ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 11,
            padding: '0 8px',
            height: '100%',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {ind}
        </button>
      ))}
    </div>
  );
}
