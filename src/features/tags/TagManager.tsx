import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

const PRESET_COLORS = [
  '#e8d5b7',
  '#d4c5a9',
  '#c9b896',
  '#b8a98a',
  '#a69a7e',
  '#d4c4b0',
  '#c4b49c',
  '#b4a48c',
  '#a4947c',
  '#948470',
];

export function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    try {
      const result = await invoke<Tag[]>('list_tags');
      setTags(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载标签失败');
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await invoke('create_tag', { name, color: newColor });
      setNewName('');
      setNewColor(null);
      setError(null);
      loadTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建标签失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_tag', { id });
      setError(null);
      loadTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除标签失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '32px',
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text)',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: '#2a2118',
            margin: '0 0 4px',
          }}
        >
          标签管理
        </h2>
        <p
          style={{
            fontSize: '12px',
            color: '#a09480',
            margin: 0,
          }}
        >
          创建和管理标签，为图片添加分类标记
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: '16px',
            background: 'rgba(180, 60, 60, 0.06)',
            border: '1px solid rgba(180, 60, 60, 0.15)',
            borderRadius: '2px',
            fontSize: '12px',
            color: '#8a4040',
          }}
        >
          {error}
        </div>
      )}

      {/* Create form */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入标签名称..."
          style={{
            flex: 1,
            maxWidth: '240px',
            padding: '8px 12px',
            fontSize: '12px',
            fontFamily: 'var(--font-body)',
            border: '1px solid rgba(139, 115, 75, 0.15)',
            borderRadius: '2px',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            outline: 'none',
            transition: 'border-color 200ms',
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              'rgba(139, 115, 75, 0.30)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              'rgba(139, 115, 75, 0.15)';
          }}
        />

        {/* Color picker */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(newColor === c ? null : c)}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '2px',
                border:
                  newColor === c
                    ? '2px solid #7a5c12'
                    : '1px solid rgba(139, 115, 75, 0.15)',
                background: c,
                cursor: 'pointer',
                transition: 'border-color 200ms',
              }}
              aria-label={`选择颜色 ${c}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={!newName.trim()}
          style={{
            padding: '8px 16px',
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            color: newName.trim() ? '#2a2118' : '#a09480',
            background: newName.trim()
              ? 'var(--color-surface)'
              : 'rgba(139, 115, 75, 0.06)',
            border: '1px solid rgba(139, 115, 75, 0.15)',
            borderRadius: '4px',
            cursor: newName.trim() ? 'pointer' : 'default',
            transition: 'all 200ms',
          }}
        >
          创建标签
        </button>
      </div>

      {/* Tag list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {tags.length === 0 ? (
          <p
            style={{
              fontSize: '12px',
              color: '#a09480',
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            暂无标签，创建一个开始使用吧
          </p>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                background: 'var(--color-surface)',
                border: '1px solid rgba(139, 115, 75, 0.08)',
                borderRadius: '2px',
                transition: 'border-color 200ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  'rgba(139, 115, 75, 0.20)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  'rgba(139, 115, 75, 0.08)';
              }}
            >
              {/* Color swatch */}
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  background: tag.color ?? 'rgba(139, 115, 75, 0.15)',
                  border: '1px solid rgba(139, 115, 75, 0.10)',
                  flexShrink: 0,
                }}
              />

              {/* Name */}
              <span
                style={{
                  flex: 1,
                  fontSize: '12px',
                  fontFamily: 'var(--font-body)',
                  color: '#2a2118',
                }}
              >
                {tag.name}
              </span>

              {/* Edit color */}
              {editingId === tag.id ? (
                <div style={{ display: 'flex', gap: '3px' }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        invoke('create_tag', {
                          name: tag.name,
                          color: c,
                        }).catch(() => {});
                        setEditingId(null);
                        loadTags();
                      }}
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '2px',
                        border: '1px solid rgba(139, 115, 75, 0.15)',
                        background: c,
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: '#a09480',
                      padding: '0 4px',
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(tag.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: '#a09480',
                    padding: '4px 8px',
                    transition: 'color 200ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#7a5c12';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#a09480';
                  }}
                >
                  编辑颜色
                </button>
              )}

              {/* Delete */}
              <button
                type="button"
                onClick={() => handleDelete(tag.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#a09480',
                  padding: '4px 8px',
                  transition: 'color 200ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#8a4040';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#a09480';
                }}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
