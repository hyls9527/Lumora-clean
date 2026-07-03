import { useEffect, useState } from 'react';
import { useTrashStore } from '../../stores/trashStore';
import { GridSkeleton } from '../../components/ui/LoadingSkeleton';
import { ErrorState } from '../../components/ui/ErrorState';

function formatDeletedTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso.replace(' ', 'T') + 'Z');
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function TrashPage() {
  const {
    images,
    loading,
    error,
    fetchTrash,
    restoreImage,
    permanentDelete,
    emptyTrash,
    page,
    total,
    perPage,
  } = useTrashStore();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    fetchTrash(1);
  }, [fetchTrash]);

  const handleRestore = async (id: string) => {
    await restoreImage(id);
  };

  const handlePermanentDelete = async (id: string) => {
    await permanentDelete(id);
    setConfirmDeleteId(null);
  };

  const handleEmptyTrash = async () => {
    await emptyTrash();
    setConfirmEmpty(false);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '14px 32px',
          background: 'var(--color-bg)',
          borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: '#2a2118',
            margin: 0,
          }}
        >
          回收站
        </h2>
        {total > 0 && (
          <button
            type="button"
            onClick={() => setConfirmEmpty(true)}
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-display)',
              color: '#b33a3a',
              background: 'none',
              border: '1px solid rgba(179, 58, 58, 0.2)',
              padding: '6px 14px',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'background 200ms, color 200ms',
            }}
          >
            清空回收站
          </button>
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: '8px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
          background: 'var(--color-bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: loading ? '#d4a574' : '#a09480',
            }}
          />
          <span style={{ fontSize: 10, color: '#a09480', fontFamily: 'var(--font-body)' }}>
            {loading ? '加载中…' : `${total} 张已删除图片`}
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <ErrorState message={error} onRetry={() => fetchTrash(page)} />
      )}

      {/* Content */}
      {loading ? (
        <GridSkeleton count={4} />
      ) : !error ? (
        <>
          {images.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: '#a09480',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 32, marginBottom: 4 }}>🗑</span>
              回收站为空
            </div>
          ) : (
            <div style={{ padding: '16px 32px' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
                      color: '#6b5d48',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '8px 12px', fontWeight: 500 }}>文件名</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500 }}>尺寸</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500 }}>删除时间</th>
                    <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {images.map((img) => (
                    <tr
                      key={img.id}
                      style={{
                        borderBottom: '1px solid rgba(139, 115, 75, 0.06)',
                        transition: 'background 200ms',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(139, 115, 75, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <td
                        style={{
                          padding: '10px 12px',
                          color: '#2a2118',
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {img.fileName}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b5d48' }}>
                        {img.width}×{img.height}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#a09480' }}>
                        {formatDeletedTime(img.deletedAt ?? '')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleRestore(img.id)}
                          style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-display)',
                            color: '#4a7a3a',
                            background: 'none',
                            border: '1px solid rgba(74, 122, 58, 0.2)',
                            padding: '4px 10px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            marginRight: 8,
                            transition: 'background 200ms',
                          }}
                        >
                          恢复
                        </button>
                        {confirmDeleteId === img.id ? (
                          <span style={{ display: 'inline-flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => handlePermanentDelete(img.id)}
                              style={{
                                fontSize: 11,
                                fontFamily: 'var(--font-display)',
                                color: '#f2ede4',
                                background: '#b33a3a',
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: 3,
                                cursor: 'pointer',
                              }}
                            >
                              确认删除
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              style={{
                                fontSize: 11,
                                fontFamily: 'var(--font-display)',
                                color: '#6b5d48',
                                background: 'none',
                                border: '1px solid rgba(139, 115, 75, 0.10)',
                                padding: '4px 10px',
                                borderRadius: 3,
                                cursor: 'pointer',
                              }}
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(img.id)}
                            style={{
                              fontSize: 11,
                              fontFamily: 'var(--font-display)',
                              color: '#b33a3a',
                              background: 'none',
                              border: '1px solid rgba(179, 58, 58, 0.15)',
                              padding: '4px 10px',
                              borderRadius: 3,
                              cursor: 'pointer',
                              transition: 'background 200ms',
                            }}
                          >
                            永久删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                padding: '12px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => fetchTrash(p)}
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: 11,
                    fontFamily: 'var(--font-body)',
                    color: p === page ? '#f2ede4' : '#6b5d48',
                    background: p === page ? '#7a5c12' : 'transparent',
                    border: p === page ? 'none' : '1px solid rgba(139, 115, 75, 0.10)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 200ms, color 200ms',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* Empty trash confirmation dialog */}
      {confirmEmpty && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(42, 33, 24, 0.5)',
          }}
          onClick={() => setConfirmEmpty(false)}
        >
          <div
            style={{
              background: '#f2ede4',
              borderRadius: 6,
              padding: '24px 28px',
              maxWidth: 360,
              boxShadow: 'rgba(139, 115, 75, 0.12) 0px 0px 0px 1px, rgba(78, 50, 23, 0.12) 0px 8px 32px',
              fontFamily: 'var(--font-body)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: '#2a2118',
                margin: '0 0 8px',
              }}
            >
              清空回收站？
            </h3>
            <p style={{ fontSize: 12, color: '#6b5d48', margin: '0 0 20px', lineHeight: 1.5 }}>
              永久删除回收站中的所有 {total} 张图片，此操作不可撤销。
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmEmpty(false)}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-display)',
                  color: '#6b5d48',
                  background: 'none',
                  border: '1px solid rgba(139, 115, 75, 0.10)',
                  padding: '6px 14px',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleEmptyTrash}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-display)',
                  color: '#f2ede4',
                  background: '#b33a3a',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div
        style={{
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(139, 115, 75, 0.10)',
          marginTop: 'auto',
        }}
      >
        <span style={{ fontSize: 11, color: '#6b5d48', fontFamily: 'var(--font-body)' }}>
          {total} 张已删除图片
        </span>
        <span style={{ fontSize: 11, color: '#6b5d48', fontFamily: 'var(--font-body)' }}>
          第 {page} / {totalPages} 页
        </span>
      </div>
    </div>
  );
}

export default TrashPage;
