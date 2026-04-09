import { useState, useEffect, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'latest';

export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>('idle');
  const [progress, setProgress] = useState(0);
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');

  const checkForUpdate = useCallback(async () => {
    setState('checking');
    try {
      const update = await check();
      if (update) {
        setVersion(update.version);
        setState('available');
      } else {
        setState('latest');
        setTimeout(() => setState('idle'), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, []);

  const doUpdate = useCallback(async () => {
    setState('downloading');
    try {
      const update = await check();
      if (!update) return;

      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            setProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        } else if (event.event === 'Finished') {
          setState('ready');
        }
      });
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, []);

  const doRelaunch = useCallback(async () => {
    // Kill python-backend sidecar before relaunch so it doesn't linger
    try { await invoke('kill_sidecar'); } catch { /* ignore */ }
    await relaunch();
  }, []);

  // Auto-check on mount (silent)
  useEffect(() => {
    const timer = setTimeout(() => {
      void checkForUpdate();
    }, 5000); // Check 5s after app starts
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  // Don't show anything in idle state
  if (state === 'idle') return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 40,
    right: 16,
    zIndex: 9998,
    background: '#1a1a2e',
    border: '1px solid #3498db',
    borderRadius: 8,
    padding: '12px 16px',
    maxWidth: 340,
    boxShadow: '0 4px 20px rgba(52, 152, 219, 0.3)',
    fontFamily: 'monospace',
    fontSize: 12,
  };

  return (
    <div style={containerStyle}>
      {state === 'checking' && (
        <span style={{ color: '#aaa' }}>正在检查更新...</span>
      )}

      {state === 'latest' && (
        <span style={{ color: '#2ecc71' }}>✓ 已是最新版本</span>
      )}

      {state === 'available' && (
        <div>
          <div style={{ color: '#3498db', marginBottom: 8 }}>
            发现新版本 <strong>v{version}</strong>
          </div>
          <button
            onClick={doUpdate}
            style={{
              background: '#3498db',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 12,
              marginRight: 8,
            }}
          >
            立即更新
          </button>
          <button
            onClick={() => setState('idle')}
            style={{
              background: 'transparent',
              color: '#888',
              border: '1px solid #555',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            稍后
          </button>
        </div>
      )}

      {state === 'downloading' && (
        <div>
          <div style={{ color: '#3498db', marginBottom: 6 }}>正在下载更新...</div>
          <div style={{
            background: '#333',
            borderRadius: 4,
            height: 6,
            overflow: 'hidden',
          }}>
            <div style={{
              background: '#3498db',
              height: '100%',
              width: `${progress}%`,
              transition: 'width 0.2s',
            }} />
          </div>
          <div style={{ color: '#888', marginTop: 4 }}>{progress}%</div>
        </div>
      )}

      {state === 'ready' && (
        <div>
          <div style={{ color: '#2ecc71', marginBottom: 8 }}>更新已下载，重启后生效</div>
          <button
            onClick={doRelaunch}
            style={{
              background: '#2ecc71',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            立即重启
          </button>
        </div>
      )}

      {state === 'error' && (
        <div>
          <div style={{ color: '#e74c3c', marginBottom: 4 }}>检查更新失败</div>
          <div style={{ color: '#888', fontSize: 11 }}>{error}</div>
          <button
            onClick={() => setState('idle')}
            style={{
              background: 'transparent',
              color: '#888',
              border: '1px solid #555',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 11,
              marginTop: 6,
            }}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
