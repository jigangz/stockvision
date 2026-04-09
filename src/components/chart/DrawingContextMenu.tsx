import { useEffect, useRef, useCallback } from 'react';
import { useDrawingStore } from '@/stores/drawingStore';

interface Props {
  x: number;
  y: number;
  onClose: () => void;
}

export function DrawingContextMenu({ x, y, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedId = useDrawingStore((s) => s.selectedId);
  const drawings = useDrawingStore((s) => s.drawings);

  const selectedDrawing = selectedId
    ? drawings.find((d) => d.id === selectedId) ?? null
    : null;

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Adjust position so menu doesn't overflow viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const handleEdit = () => {
    if (selectedId) {
      useDrawingStore.getState().setEditing(selectedId);
    }
    onClose();
  };

  const handleDelete = () => {
    if (selectedId) {
      useDrawingStore.getState().removeDrawing(selectedId);
      useDrawingStore.getState().selectDrawing(null);
    }
    onClose();
  };

  const handleToggleLock = () => {
    if (selectedId) {
      useDrawingStore.getState().toggleLock(selectedId);
    }
    onClose();
  };

  const handleUndo = () => {
    const { drawings: drs } = useDrawingStore.getState();
    if (drs.length > 0) {
      const last = drs[drs.length - 1];
      useDrawingStore.getState().removeDrawing(last.id);
    }
    onClose();
  };

  const handleClearAll = () => {
    useDrawingStore.getState().clearAll();
    onClose();
  };

  const items: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }> = selectedDrawing
    ? [
        { label: '编辑画线', onClick: handleEdit },
        { label: '删除画线', onClick: handleDelete },
        {
          label: selectedDrawing.locked ? '解锁画线' : '锁定画线',
          onClick: handleToggleLock,
        },
      ]
    : [
        {
          label: '撤销上一步',
          onClick: handleUndo,
          disabled: drawings.length === 0,
        },
        {
          label: '清除所有画线',
          onClick: handleClearAll,
          disabled: drawings.length === 0,
        },
      ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        padding: '4px 0',
        minWidth: 140,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={item.disabled ? undefined : item.onClick}
          style={{
            padding: '6px 16px',
            color: item.disabled ? '#666' : '#fff',
            cursor: item.disabled ? 'default' : 'pointer',
            fontSize: 13,
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) {
              (e.currentTarget as HTMLDivElement).style.background = '#2a2a2e';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
