import { useState } from 'react';
import { ALL_INDICATORS, type IndicatorType, useIndicatorStore } from '@/stores/indicatorStore';
import { IndicatorParamsDialog } from './IndicatorParamsDialog';

export function IndicatorTabBar(): React.ReactElement {
  const activeSection = useIndicatorStore((s) => s.activeSection);
  const activeIndicatorUpper = useIndicatorStore((s) => s.activeIndicatorUpper);
  const activeIndicatorLower = useIndicatorStore((s) => s.activeIndicatorLower);
  const setActiveIndicatorUpper = useIndicatorStore((s) => s.setActiveIndicatorUpper);
  const setActiveIndicatorLower = useIndicatorStore((s) => s.setActiveIndicatorLower);
  // Keep backward compat
  const setActiveIndicator = useIndicatorStore((s) => s.setActiveIndicator);
  const [paramsTarget, setParamsTarget] = useState<IndicatorType | null>(null);

  // The currently active indicator for the focused section
  const currentActive = activeSection === 'upper' ? activeIndicatorUpper : activeIndicatorLower;

  const handleClick = (ind: IndicatorType) => {
    if (activeSection === 'upper') {
      setActiveIndicatorUpper(ind);
    } else {
      setActiveIndicatorLower(ind);
    }
    // backward compat
    setActiveIndicator(ind);
  };

  const setActiveSection = useIndicatorStore((s) => s.setActiveSection);

  return (
    <>
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
        {/* Section selector */}
        <button
          onClick={() => setActiveSection(activeSection === 'upper' ? 'lower' : 'upper')}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 2,
            color: activeSection === 'upper' ? '#FFFF00' : '#00CCFF',
            fontSize: 10,
            padding: '0 6px',
            height: 16,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginRight: 6,
            marginLeft: 4,
          }}
          title={`当前编辑: ${activeSection === 'upper' ? '中间面板' : '下方面板'} (点击切换)`}
        >
          {activeSection === 'upper' ? '▲中' : '▼下'}
        </button>
        {ALL_INDICATORS.map((ind: IndicatorType) => (
          <button
            key={ind}
            onClick={() => handleClick(ind)}
            onDoubleClick={() => setParamsTarget(ind)}
            onContextMenu={(e) => {
              e.preventDefault();
              setParamsTarget(ind);
            }}
            style={{
              flexShrink: 0,
              background: currentActive === ind ? 'var(--bg-panel)' : 'transparent',
              border: 'none',
              borderBottom: currentActive === ind ? '2px solid var(--color-up)' : '2px solid transparent',
              color: currentActive === ind ? 'var(--text-primary)' : 'var(--text-muted)',
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

      {paramsTarget && (
        <IndicatorParamsDialog
          indicator={paramsTarget}
          onClose={() => setParamsTarget(null)}
        />
      )}
    </>
  );
}
