import { useHealthMonitor } from '@/hooks/useHealthMonitor';

const toastStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 9999,
    maxWidth: 420,
    background: '#1a1a2e',
    border: '1px solid #e74c3c',
    borderRadius: 8,
    padding: '14px 18px',
    boxShadow: '0 4px 24px rgba(231, 76, 60, 0.3)',
    animation: 'slideIn 0.3s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: '#e74c3c',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: 18,
    padding: '0 4px',
    lineHeight: 1,
  },
  message: {
    color: '#ccc',
    fontSize: 12,
    lineHeight: 1.5,
    wordBreak: 'break-word' as const,
  },
  meta: {
    color: '#666',
    fontSize: 11,
    marginTop: 6,
  },
  indicator: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#e74c3c',
    marginRight: 8,
    animation: 'pulse 1.5s infinite',
  },
};

// Inject keyframes once
const styleId = 'api-health-toast-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
}

export function ApiHealthToast() {
  const { status, showWarning, dismiss } = useHealthMonitor();

  if (!showWarning || !status) return null;

  const timeStr = status.last_error_time
    ? new Date(status.last_error_time * 1000).toLocaleTimeString('zh-CN')
    : '';

  const sourceLabel =
    status.last_error_source === 'backend' ? '后端服务' : `数据源 (${status.last_error_source})`;

  return (
    <div style={toastStyles.container}>
      <div style={toastStyles.header}>
        <span style={toastStyles.title}>
          <span style={toastStyles.indicator} />
          {sourceLabel}接口异常
        </span>
        <button style={toastStyles.dismissBtn} onClick={dismiss} title="关闭">
          &times;
        </button>
      </div>
      <div style={toastStyles.message}>{status.last_error}</div>
      <div style={toastStyles.meta}>
        连续失败 {status.consecutive_failures} 次
        {timeStr && ` · 最近错误 ${timeStr}`}
      </div>
    </div>
  );
}
