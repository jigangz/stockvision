/**
 * FormulaEditor — 通达信-style custom formula editor dialog.
 *
 * Features:
 * - Monaco Editor with syntax highlighting for formula keywords
 * - Real-time validation (debounced 500ms)
 * - Execute button: sends to /api/formula/evaluate, overlays results on chart
 * - Results displayed as line series on the indicator sub-chart area
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { OhlcvData } from '@/stores/dataStore';

interface FormulaSeries {
  name: string;
  data: { time: number; value: number }[];
}

interface FormulaEditorProps {
  candles: OhlcvData[];
  onClose: () => void;
  onResult: (series: FormulaSeries[]) => void;
}

const BUILTIN_KEYWORDS = [
  'MA', 'EMA', 'SMA', 'REF', 'REFX', 'CROSS', 'LONGCROSS',
  'HHV', 'LLV', 'COUNT', 'BARSLAST', 'SUM',
  'OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOL', 'AMOUNT',
  'AND', 'OR', 'NOT',
];

const DEFAULT_FORMULA = `{示例公式 — 自定义MACD}
DIF := EMA(CLOSE, 12) - EMA(CLOSE, 26)
DEA := EMA(DIF, 9)
MACD := (DIF - DEA) * 2`;

const API_BASE = 'http://localhost:8899';

export function FormulaEditor({ candles, onClose, onResult }: FormulaEditorProps) {
  const [formula, setFormula] = useState(DEFAULT_FORMULA);
  const [validating, setValidating] = useState(false);
  const [validError, setValidError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FormulaSeries[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validate on formula change (debounced 500ms)
  const validate = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setValidating(true);
      try {
        const resp = await fetch(`${API_BASE}/api/formula/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formula: text }),
        });
        const data = await resp.json() as { valid: boolean; error: string };
        setValidError(data.valid ? null : data.error);
      } catch {
        setValidError(null); // network error — don't block user
      } finally {
        setValidating(false);
      }
    }, 500);
  }, []);

  useEffect(() => {
    validate(formula);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formula, validate]);

  const handleRun = async () => {
    if (!candles.length) return;
    setRunning(true);
    setRunError(null);
    try {
      const candleData = candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        amount: c.amount ?? 0,
      }));
      const resp = await fetch(`${API_BASE}/api/formula/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formula, data: candleData }),
      });
      if (!resp.ok) {
        const err = await resp.json() as { detail: string };
        throw new Error(err.detail ?? `HTTP ${resp.status}`);
      }
      const result = await resp.json() as { series: FormulaSeries[] };
      setLastResult(result.series);
      onResult(result.series);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    // Register custom language for 通达信 formulas
    monaco.languages.register({ id: 'tdxformula' });
    monaco.languages.setMonarchTokensProvider('tdxformula', {
      tokenizer: {
        root: [
          [/\{[^}]*\}/, 'comment'],
          [/:=/, 'operator'],
          [/[+\-*/><!=]/, 'operator'],
          [new RegExp(`\\b(${BUILTIN_KEYWORDS.join('|')})\\b`), 'keyword'],
          [/[A-Za-z_][A-Za-z0-9_]*/, 'identifier'],
          [/[0-9]+(\.[0-9]+)?/, 'number'],
          [/[ \t\r\n]+/, 'white'],
        ],
      },
    });
    monaco.editor.defineTheme('tdx-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '888888', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'FF4444', fontStyle: 'bold' },
        { token: 'operator', foreground: 'CCCCCC' },
        { token: 'number', foreground: 'FFFF00' },
        { token: 'identifier', foreground: '00CCFF' },
      ],
      colors: {
        'editor.background': '#0D0D1A',
        'editor.foreground': '#CCCCCC',
        'editorCursor.foreground': '#FFFFFF',
        'editor.lineHighlightBackground': '#1A1A2E',
        'editorLineNumber.foreground': '#555555',
      },
    });
    monaco.editor.setModelLanguage(editor.getModel()!, 'tdxformula');
    monaco.editor.setTheme('tdx-dark');
  };

  const statusText = validating
    ? '验证中...'
    : validError
    ? `语法错误: ${validError.slice(0, 120)}`
    : '语法正确 ✓';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 300,
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        width: 700,
        maxWidth: '95vw',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-panel)',
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
            自定义公式编辑器
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
              padding: '0 4px',
            }}
          >✕</button>
        </div>

        {/* Monaco Editor */}
        <div style={{ height: 220 }}>
          <Editor
            height="220px"
            defaultLanguage="tdxformula"
            defaultValue={DEFAULT_FORMULA}
            theme="vs-dark"
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              wordWrap: 'off',
              automaticLayout: true,
            }}
            onChange={(val) => {
              const text = val ?? '';
              setFormula(text);
            }}
            onMount={handleEditorMount}
          />
        </div>

        {/* Status bar */}
        <div style={{
          padding: '4px 12px',
          fontSize: 11,
          color: validError ? 'var(--color-up)' : 'var(--color-down)',
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--border)',
          minHeight: 22,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {statusText}
        </div>

        {/* Built-in reference */}
        <div style={{
          padding: '6px 12px',
          fontSize: 11,
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          lineHeight: 1.6,
        }}>
          <span style={{ color: 'var(--text-secondary)', marginRight: 6 }}>内置函数:</span>
          {['MA', 'EMA', 'SMA', 'REF', 'REFX', 'CROSS', 'HHV', 'LLV', 'COUNT', 'BARSLAST', 'SUM'].map((fn) => (
            <span key={fn} style={{ color: 'var(--color-up)', marginRight: 8 }}>{fn}</span>
          ))}
          <br />
          <span style={{ color: 'var(--text-secondary)', marginRight: 6 }}>内置变量:</span>
          {['OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOL', 'AMOUNT'].map((v) => (
            <span key={v} style={{ color: '#00CCFF', marginRight: 8 }}>{v}</span>
          ))}
        </div>

        {/* Run error */}
        {runError && (
          <div style={{
            padding: '4px 12px',
            fontSize: 11,
            color: 'var(--color-up)',
            background: '#1a0000',
            borderTop: '1px solid var(--border)',
          }}>
            运行错误: {runError}
          </div>
        )}

        {/* Result summary */}
        {lastResult && !runError && (
          <div style={{
            padding: '4px 12px',
            fontSize: 11,
            color: 'var(--color-down)',
            background: '#001a00',
            borderTop: '1px solid var(--border)',
          }}>
            输出 {lastResult.length} 条指标线:
            {lastResult.map((s) => (
              <span key={s.name} style={{ marginLeft: 8 }}>{s.name}({s.data.length}点)</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '4px 16px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              borderRadius: 2,
              fontSize: 12,
            }}
          >
            关闭
          </button>
          <button
            onClick={handleRun}
            disabled={running || !!validError}
            style={{
              padding: '4px 16px',
              background: running || validError ? '#333' : 'var(--color-up)',
              border: 'none',
              color: running || validError ? 'var(--text-muted)' : '#fff',
              cursor: running || validError ? 'default' : 'pointer',
              borderRadius: 2,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {running ? '计算中...' : '执行公式'}
          </button>
        </div>
      </div>
    </div>
  );
}
