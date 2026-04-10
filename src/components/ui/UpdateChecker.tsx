import { useState, useEffect, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { invoke } from '@tauri-apps/api/core';

type UpdateState = 'idle' | 'checking' | 'available' | 'confirming' | 'killing' | 'downloading' | 'ready' | 'error' | 'latest';

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
    // Step 1: Kill Python backend first
    setState('killing');
    try {
      await invoke('kill_sidecar');
    } catch {
      // ignore — might already be dead or running in dev mode
    }

    // Step 2: Download and install
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
    // Kill again just in case, then relaunch
    try { await invoke('kill_sidecar'); } catch { /* ignore */ }
    await relaunch();
  }, []);

  // Auto-check on mount (silent)
  useEffect(() => {
    const timer = setTimeout(() => {
      void checkForUpdate();
    }, 5000);
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

  const primaryBtn: React.CSSProperties = {
    background: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: 12,
    marginRight: 8,
  };

  const secondaryBtn: React.CSSProperties = {
    background: 'transparent',
    color: '#888',
    border: '1px solid #555',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 12,
  };

  return (
    <div style={containerStyle}>
      {state === 'checking' && (
        <span style={{ color: '#aaa' }}>正在检查更新...</span>
      )}

      {state === 'latest' && (
        <span style={{ color: '#2ecc71' }}>已是最新版本</span>
      )}

      {state === 'available' && (
        <div>
          <div style={{ color: '#3498db', marginBottom: 8 }}>
            发现新版本 <strong>v{version}</strong>
          </div>
          <button onClick={() => setState('confirming')} style={primaryBtn}>
            立即更新
          </button>
          <button onClick={() => setState('idle')} style={secondaryBtn}>
            稍后
          </button>
        </div>
      )}

      {state === 'confirming' && (
        <div>
          <div style={{ color: '#f39c12', marginBottom: 8, lineHeight: 1.6 }}>
            更新将执行以下操作：
          </div>
          <div style={{ color: '#ccc', fontSize: 11, marginBottom: 8, lineHeight: 1.6 }}>
            1. 关闭 Python 后端进程<br />
            2. 下载新版本 v{version}<br />
            3. 安装并重启应用
          </div>
          <div style={{ color: '#f39c12', fontSize: 11, marginBottom: 10 }}>
            更新期间行情数据将暂时不可用，确认继续？
          </div>
          <button onClick={() => void doUpdate()} style={{ ...primaryBtn, background: '#f39c12' }}>
            确认更新
          </button>
          <button onClick={() => setState('available')} style={secondaryBtn}>
            返回
          </button>
        </div>
      )}

      {state === 'killing' && (
        <div>
          <span style={{ color: '#f39c12' }}>正在关闭后端进程...</span>
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
          <div style={{ color: '#2ecc71', marginBottom: 8 }}>
            更新已下载完成，重启后生效
          </div>
          <button
            onClick={() => void doRelaunch()}
            style={{ ...primaryBtn, background: '#2ecc71' }}
          >
            立即重启
          </button>
        </div>
      )}

      {state === 'error' && (
        <div>
          <div style={{ color: '#e74c3c', marginBottom: 4 }}>更新失败</div>
          <div style={{ color: '#888', fontSize: 11 }}>{error}</div>
          <button
            onClick={() => setState('idle')}
            style={{ ...secondaryBtn, marginTop: 6 }}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
