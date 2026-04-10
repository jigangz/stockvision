import { useEffect, useState, useRef, useCallback } from 'react';
import { useChartSettingsStore } from '@/stores/chartSettingsStore';
import { useDataStore } from '@/stores/dataStore';
import { useChartStore } from '@/stores/chartStore';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

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

type SyncStatus = {
  scheduler_running: boolean;
  next_run: string | null;
  last_sync: { time: string; status: string; message: string } | null;
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

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-secondary)', width: 100, flexShrink: 0,
};

const TABS = ['数据源配置', '数据拉取', '自动同步', '手动导入', '导入日志'] as const;
type Tab = (typeof TABS)[number];

const PULL_DAYS_OPTIONS = [
  { label: '30天', value: 30 },
  { label: '90天', value: 90 },
  { label: '180天 (半年)', value: 180 },
  { label: '280天 (默认)', value: 280 },
  { label: '365天 (1年)', value: 365 },
  { label: '730天 (2年)', value: 730 },
  { label: '1095天 (3年)', value: 1095 },
  { label: '1825天 (5年)', value: 1825 },
];

export function DataSourceSettings({ onClose }: Props): React.ReactElement {
  const fetchKlineInitial = useDataStore((s) => s.fetchKlineInitial);
  const currentCode = useChartStore((s) => s.currentCode);
  const currentMarket = useChartStore((s) => s.currentMarket);
  const currentPeriod = useChartStore((s) => s.currentPeriod);

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const dragSrcIdx = useRef<number | null>(null);

  const displayDays = useChartSettingsStore((s) => s.displayDays);
  const setDisplayDays = useChartSettingsStore((s) => s.setDisplayDays);
  const saveSettings = useChartSettingsStore((s) => s.saveSettings);

  // Load config on mount
  useEffect(() => {
    fetch(`${API}/api/datasource/config`)
      .then((r) => r.json())
      .then((d: Config) => setConfig(d))
      .catch(() => undefined);
  }, []);

  // Load sync status
  useEffect(() => {
    if (activeTab === '自动同步') {
      fetch(`${API}/api/scheduler/status`)
        .then((r) => r.json())
        .then((d: SyncStatus) => setSyncStatus(d))
        .catch(() => undefined);
    }
  }, [activeTab, syncing]);

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

  const pickTdxFolder = useCallback(async (idx: number) => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: '选择通达信安装目录',
      });
      if (selected && typeof selected === 'string') {
        updateSource(idx, { directory: selected });
      }
    } catch {
      // User cancelled or dialog not available
    }
  }, []);

  async function saveConfig(): Promise<void> {
    setSaving(true);
    try {
      await fetch(`${API}/api/datasource/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      // Notify StatusBar to refresh adapter name immediately
      window.dispatchEvent(new Event('adapter-changed'));

      // Re-fetch kline data with the new adapter
      const end = new Date().toISOString().slice(0, 10);
      const d = new Date();
      d.setDate(d.getDate() - displayDays);
      const start = d.toISOString().slice(0, 10);
      void fetchKlineInitial(currentCode, currentMarket, currentPeriod, start, end);
    } catch {
      undefined;
    } finally {
      setSaving(false);
    }
  }

  async function triggerSyncNow(): Promise<void> {
    setSyncing(true);
    try {
      await fetch(`${API}/api/scheduler/trigger`, { method: 'POST' });
      // Wait a moment then refresh status
      setTimeout(() => {
        fetch(`${API}/api/scheduler/status`)
          .then((r) => r.json())
          .then((d: SyncStatus) => setSyncStatus(d))
          .catch(() => undefined)
          .finally(() => setSyncing(false));
      }, 2000);
    } catch {
      setSyncing(false);
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
      setImportResult(data.ok ? `OK ${data.message} (格式: ${data.format})` : `FAIL ${data.message}`);
    } catch {
      setImportResult('FAIL 网络错误');
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

  async function handleDisplayDaysChange(days: number): Promise<void> {
    setDisplayDays(days);
    await saveSettings({ displayDays: days });
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
          <button style={{ ...btnStyle, border: 'none' }} onClick={onClose}>X</button>
        </div>

        {/* Tab bar */}
        <div style={tabBarStyle}>
          {TABS.map((t) => (
            <button key={t} style={tabBtn(t)} onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          {/* == 数据源配置 == */}
          {activeTab === '数据源配置' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 0 8px' }}>
                拖动行可调整数据源优先级（从高到低）。启用的数据源按优先级依次尝试。
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

                  {/* AKShare — no key needed */}
                  {src.id === 'akshare' && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 22 }}>
                      免费数据源，无需 API Key。支持日线/周线/月线。
                    </div>
                  )}

                  {/* Tushare token */}
                  {src.id === 'tushare' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>
                        Token:
                      </span>
                      <input
                        type="password"
                        style={inputStyle}
                        value={src.api_key ?? ''}
                        placeholder="输入 Tushare Pro Token (tushare.pro 注册获取)"
                        onChange={(e) => updateSource(idx, { api_key: e.target.value })}
                      />
                    </div>
                  )}

                  {/* 通达信 directory */}
                  {src.id === 'tdx' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>目录:</span>
                        <input
                          type="text"
                          style={inputStyle}
                          value={src.directory ?? ''}
                          placeholder="点击右侧按钮选择通达信安装目录"
                          onChange={(e) => updateSource(idx, { directory: e.target.value })}
                          readOnly
                        />
                        <button
                          style={{ ...btnStyle, flexShrink: 0, padding: '3px 10px' }}
                          onClick={() => void pickTdxFolder(idx)}
                        >
                          浏览...
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 66 }}>
                        需包含 vipdoc 子目录。支持 .day (日线) / .5 (5分钟) / .1 (1分钟) 文件。
                      </div>
                    </div>
                  )}

                  {/* Test result */}
                  {testResults[src.id] && (
                    <div style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: testResults[src.id].ok ? '#00CC00' : 'var(--color-up)',
                    }}>
                      {testResults[src.id].ok ? '[OK]' : '[FAIL]'} {testResults[src.id].message}
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

          {/* == 数据拉取 == */}
          {activeTab === '数据拉取' && (
            <div>
              <div style={rowStyle}>
                <span style={labelStyle}>拉取天数:</span>
                <select
                  value={displayDays}
                  onChange={(e) => void handleDisplayDaysChange(Number(e.target.value))}
                  style={{ ...inputStyle, width: 200 }}
                >
                  {PULL_DAYS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>自定义天数:</span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={displayDays}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (v > 0 && v <= 3650) void handleDisplayDaysChange(v);
                  }}
                  style={{ ...inputStyle, width: 100 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>天 (1-3650)</span>
              </div>

              <div style={{
                background: 'var(--bg-panel)', border: '1px solid var(--border)',
                borderRadius: 3, padding: 10, marginTop: 8,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  <div>当前设置: 拉取最近 <span style={{ color: '#FFFF00' }}>{displayDays}</span> 天的历史数据</div>
                  <div>- 30天: 适合短线看盘，加载最快</div>
                  <div>- 280天 (默认): 约1年数据，满足大部分技术分析需求</div>
                  <div>- 730天+: 适合长线分析，首次加载较慢</div>
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    修改后切换股票或刷新即可生效。数据会缓存到本地 Parquet 文件。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* == 自动同步 == */}
          {activeTab === '自动同步' && (
            <div>
              <div style={rowStyle}>
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

              <div style={rowStyle}>
                <span style={labelStyle}>同步时间:</span>
                <input
                  type="time"
                  value={config.sync_time}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sync_time: e.target.value }))}
                  style={{ ...inputStyle, width: 120 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>（建议收盘后 15:30）</span>
              </div>

              {/* Sync status panel */}
              <div style={{
                background: 'var(--bg-panel)', border: '1px solid var(--border)',
                borderRadius: 3, padding: 10, marginTop: 8, marginBottom: 12,
              }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>同步状态</div>
                {syncStatus ? (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div>
                      调度器: {syncStatus.scheduler_running
                        ? <span style={{ color: '#00CC00' }}>运行中</span>
                        : <span style={{ color: 'var(--color-up)' }}>未启动</span>}
                    </div>
                    {syncStatus.next_run && (
                      <div>下次同步: <span style={{ color: '#FFFF00' }}>{syncStatus.next_run}</span></div>
                    )}
                    {syncStatus.last_sync && (
                      <>
                        <div>上次同步: {syncStatus.last_sync.time}</div>
                        <div>
                          状态: {syncStatus.last_sync.status === 'completed'
                            ? <span style={{ color: '#00CC00' }}>成功</span>
                            : <span style={{ color: 'var(--color-up)' }}>失败</span>}
                          {' — '}{syncStatus.last_sync.message}
                        </div>
                      </>
                    )}
                    {!syncStatus.last_sync && (
                      <div style={{ color: 'var(--text-muted)' }}>尚未执行过同步</div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>加载中...</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  style={btnStyle}
                  onClick={() => void triggerSyncNow()}
                  disabled={syncing}
                >
                  {syncing ? '同步中...' : '立即同步'}
                </button>
                <button
                  style={{ ...btnStyle, background: 'var(--color-up)', color: '#fff', border: 'none' }}
                  onClick={() => void saveConfig()}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存设置'}
                </button>
              </div>

              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 12 }}>
                自动同步将在指定时间（周一至周五）从已启用的数据源拉取最新日线数据，并保存到本地。
                同步范围：自选股列表中的股票（最多50只），无自选股时同步默认股票。
              </p>
            </div>
          )}

          {/* == 手动导入 == */}
          {activeTab === '手动导入' && (
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                支持格式：CSV、XLSX、通达信 .day (日线) / .5 (5分钟) / .1 (1分钟) 文件。系统自动识别格式。
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
                <div style={{ fontSize: 28, marginBottom: 6 }}>+</div>
                {importing ? '导入中...' : '拖放文件到此处'}
                <div style={{ fontSize: 10, marginTop: 4 }}>支持 .csv / .xlsx / .xls / .day / .5 / .1</div>
              </div>

              {importResult && (
                <div style={{
                  padding: '6px 10px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  fontSize: 11,
                  color: importResult.startsWith('OK') ? '#00CC00' : 'var(--color-up)',
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

          {/* == 导入日志 == */}
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
                        <td style={{ padding: '3px 6px', textAlign: 'right', color: '#00CC00' }}>{log.count}</td>
                        <td style={{ padding: '3px 6px', color: log.status === 'success' ? '#00CC00' : 'var(--color-up)' }}>
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
