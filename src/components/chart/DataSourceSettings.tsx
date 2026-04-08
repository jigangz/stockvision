import { useEffect, useState, useRef } from 'react';

const API = 'http://localhost:8899';

type DataSource = {
  id: string;
  name: string;
  enabled: boolean;
  api_key?: string;
  directory?: string;
};

type Config = {
  sources: DataSource[];
  sync_time: string;
  auto_sync: boolean;
};

type ImportLog = {
  id: number;
  timestamp: string;
  source: string;
  filename: string;
  count: number;
  status: string;
  details: string | null;
};

type Props = { onClose: () => void };

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  width: 680,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  color: 'var(--text-primary)',
  fontFamily: 'monospace',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
  fontWeight: 'bold',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-panel)',
};

const bodyStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: 12,
};

const btnStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-secondary)',
  fontSize: 11,
  padding: '3px 8px',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-primary)',
  fontSize: 11,
  padding: '3px 6px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const TABS = ['数据源配置', '自动同步', '手动导入', '导入日志'] as const;
type Tab = (typeof TABS)[number];

export function DataSourceSettings({ onClose }: Props): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('数据源配置');
  const [config, setConfig] = useState<Config>({
    sources: [],
    sync_time: '15:30',
    auto_sync: true,
  });
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const [dragOverDrop, setDragOverDrop] = useState(false);
  const dragSrcIdx = useRef<number | null>(null);

  // Load config on mount
  useEffect(() => {
    fetch(`${API}/api/datasource/config`)
      .then((r) => r.json())
      .then((d: Config) => setConfig(d))
      .catch(() => undefined);
  }, []);

  // Load logs when switching to logs tab
  useEffect(() => {
    if (activeTab === '导入日志') {
      setLogsLoading(true);
      fetch(`${API}/api/datasource/logs`)
        .then((r) => r.json())
        .then((d: ImportLog[]) => setLogs(d))
        .catch(() => undefined)
        .finally(() => setLogsLoading(false));
    }
  }, [activeTab]);

  function updateSource(idx: number, patch: Partial<DataSource>): void {
    setConfig((prev) => {
      const sources = prev.sources.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...prev, sources };
    });
  }

  async function testSource(idx: number): Promise<void> {
    const src = config.sources[idx];
    setTesting((prev) => ({ ...prev, [src.id]: true }));
    try {
      const res = await fetch(`${API}/api/datasource/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: src.id, api_key: src.api_key, directory: src.directory }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setTestResults((prev) => ({ ...prev, [src.id]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [src.id]: { ok: false, message: '网络错误' } }));
    } finally {
      setTesting((prev) => ({ ...prev, [src.id]: false }));
    }
  }

  async function saveConfig(): Promise<void> {
    setSaving(true);
    try {
      await fetch(`${API}/api/datasource/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch {
      undefined;
    } finally {
      setSaving(false);
    }
  }

  // Drag-sort handlers for source priority
  function onDragStart(idx: number): void {
    dragSrcIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number): void {
    e.preventDefault();
    const from = dragSrcIdx.current;
    if (from === null || from === idx) return;
    setConfig((prev) => {
      const sources = [...prev.sources];
      const [item] = sources.splice(from, 1);
      sources.splice(idx, 0, item);
      dragSrcIdx.current = idx;
      return { ...prev, sources };
    });
  }

  function onDragEnd(): void {
    dragSrcIdx.current = null;
  }

  async function importFile(filename: string, source: string): Promise<void> {
    setImporting(true);
    setImportResult('');
    try {
      const res = await fetch(`${API}/api/datasource/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, source }),
      });
      const data = await res.json() as { ok: boolean; message: string; format: string; count: number };
      setImportResult(data.ok ? `✓ ${data.message} (格式: ${data.format})` : `✗ ${data.message}`);
    } catch {
      setImportResult('✗ 网络错误');
    } finally {
      setImporting(false);
    }
  }

  function onDropFile(e: React.DragEvent): void {
    e.preventDefault();
    setDragOverDrop(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    void importFile(file.name, file.name);
  }

  async function clearLogs(): Promise<void> {
    await fetch(`${API}/api/datasource/logs`, { method: 'DELETE' });
    setLogs([]);
  }

  const tabBtn = (tab: Tab): React.CSSProperties => ({
    background: 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--color-up)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'monospace',
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span>数据源管理</span>
          <button style={{ ...btnStyle, border: 'none' }} onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={tabBarStyle}>
          {TABS.map((t) => (
            <button key={t} style={tabBtn(t)} onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {/* ── 数据源配置 ── */}
          {activeTab === '数据源配置' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 8px' }}>
                拖动行可调整数据源优先级（从高到低）。
              </p>
              {config.sources.map((src, idx) => (
                <div
                  key={src.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '8px 10px',
                    marginBottom: 8,
                    cursor: 'grab',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>☰</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={src.enabled}
                        onChange={(e) => updateSource(idx, { enabled: e.target.checked })}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 'bold' }}>{src.name}</span>
                    </label>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 2 }}>
                      优先级 {idx + 1}
                    </span>
                    <button
                      style={btnStyle}
                      onClick={() => void testSource(idx)}
                      disabled={testing[src.id]}
                    >
                      {testing[src.id] ? '测试中...' : '测试连接'}
                    </button>
                  </div>

                  {/* AKShare/Tushare API key */}
                  {(src.id === 'akshare' || src.id === 'tushare') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>
                        {src.id === 'tushare' ? 'Token:' : 'API Key:'}
                      </span>
                      <input
                        type="password"
                        style={inputStyle}
                        value={src.api_key ?? ''}
                        placeholder={src.id === 'akshare' ? '无需 API Key (留空即可)' : '输入 Tushare Token'}
                        onChange={(e) => updateSource(idx, { api_key: e.target.value })}
                      />
                    </div>
                  )}

                  {/* 通达信 directory */}
                  {src.id === 'tdx' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>目录:</span>
                      <input
                        type="text"
                        style={inputStyle}
                        value={src.directory ?? ''}
                        placeholder="通达信安装目录，如 C:\TDX\vipdoc"
                        onChange={(e) => updateSource(idx, { directory: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Test result */}
                  {testResults[src.id] && (
                    <div style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: testResults[src.id].ok ? 'var(--color-down)' : 'var(--color-up)',
                    }}>
                      {testResults[src.id].ok ? '✓' : '✗'} {testResults[src.id].message}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  style={{ ...btnStyle, background: 'var(--color-up)', color: '#fff', border: 'none' }}
                  onClick={() => void saveConfig()}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </div>
          )}

          {/* ── 自动同步 ── */}
          {activeTab === '自动同步' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={config.auto_sync}
                    onChange={(e) => setConfig((prev) => ({ ...prev, auto_sync: e.target.checked }))}
                    style={{ cursor: 'pointer' }}
                  />
                  启用自动同步
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 80 }}>同步时间:</span>
                <input
                  type="time"
                  value={config.sync_time}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sync_time: e.target.value }))}
                  style={{ ...inputStyle, width: 120 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>（建议收盘后 15:30）</span>
              </div>

              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                自动同步将在指定时间从已启用的数据源拉取最新行情数据，并保存到本地 Parquet 文件。
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  style={{ ...btnStyle, background: 'var(--color-up)', color: '#fff', border: 'none' }}
                  onClick={() => void saveConfig()}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存设置'}
                </button>
              </div>
            </div>
          )}

          {/* ── 手动导入 ── */}
          {activeTab === '手动导入' && (
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                支持格式：CSV、XLSX、通达信 .day/.5/.1 文件。系统自动识别格式。
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOverDrop(true); }}
                onDragLeave={() => setDragOverDrop(false)}
                onDrop={onDropFile}
                style={{
                  border: `2px dashed ${dragOverDrop ? 'var(--color-up)' : 'var(--border)'}`,
                  borderRadius: 4,
                  padding: 32,
                  textAlign: 'center',
                  color: dragOverDrop ? 'var(--color-up)' : 'var(--text-muted)',
                  fontSize: 12,
                  transition: 'all 0.15s',
                  marginBottom: 12,
                  cursor: 'default',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                {importing ? '导入中...' : '拖放文件到此处'}
                <div style={{ fontSize: 10, marginTop: 4 }}>支持 .csv · .xlsx · .xls · .day · .5 · .1</div>
              </div>

              {importResult && (
                <div style={{
                  padding: '6px 10px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  fontSize: 11,
                  color: importResult.startsWith('✓') ? 'var(--color-down)' : 'var(--color-up)',
                  marginBottom: 12,
                }}>
                  {importResult}
                </div>
              )}

              {/* Quick import buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle} onClick={() => void importFile('sample.csv', 'csv')}>
                  导入 CSV 示例
                </button>
                <button style={btnStyle} onClick={() => void importFile('sample.xlsx', 'xlsx')}>
                  导入 XLSX 示例
                </button>
                <button style={btnStyle} onClick={() => void importFile('sh000001.day', 'tdx_day')}>
                  导入通达信示例
                </button>
              </div>
            </div>
          )}

          {/* ── 导入日志 ── */}
          {activeTab === '导入日志' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button style={btnStyle} onClick={() => void clearLogs()}>清空日志</button>
              </div>
              {logsLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>加载中...</div>
              ) : logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 24 }}>
                  暂无导入记录
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                      {['时间', '来源', '文件名', '记录数', '状态', '详情'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 'normal' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--grid-line)' }}>
                        <td style={{ padding: '3px 6px', color: 'var(--text-muted)' }}>{log.timestamp}</td>
                        <td style={{ padding: '3px 6px' }}>{log.source}</td>
                        <td style={{ padding: '3px 6px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.filename}</td>
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--color-down)' }}>{log.count}</td>
                        <td style={{ padding: '3px 6px', color: log.status === 'success' ? 'var(--color-down)' : 'var(--color-up)' }}>
                          {log.status === 'success' ? '成功' : '失败'}
                        </td>
                        <td style={{ padding: '3px 6px', color: 'var(--text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.details ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
