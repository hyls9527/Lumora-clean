import { useEffect, useState } from 'react';
import { useTrashStore } from '../../stores/trashStore';
import { GridSkeleton } from '../../components/ui/LoadingSkeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { t } from '../../lib/tokens';

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

  const isMobile = useIsMobile();
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
          padding: '12px 16px',
          background: 'var(--color-bg)',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? 18 : 20,
            fontWeight: 600,
            fontFamily: t.fontDisplay,
            color: t.text,
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
              fontFamily: t.fontDisplay,
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
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${t.border}`,
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
              background: loading ? '#d4a574' : t.textMuted,
            }}
          />
          <span style={{ fontSize: 10, color: t.textMuted, fontFamily: t.fontBody }}>
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
                color: t.textMuted,
                fontFamily: t.fontBody,
                fontSize: 13,
              }}
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 16h24M18 16V12h12v4M16 16v20h16V16" stroke="#c4b89e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 22v10M24 22v10M28 22v10" stroke="#c4b89e" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 15, fontFamily: t.fontDisplay, marginBottom: 4, color: 'var(--color-text-secondary)' }}>废纸成尘</span>
              回收站为空
            </div>
          ) : (
            <div style={{ padding: isMobile ? '12px 16px' : '16px 32px', overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: t.fontBody,
                  fontSize: isMobile ? 11 : 12,
                  minWidth: isMobile ? 480 : 'auto',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${t.border}`,
                      color: t.textSecondary,
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
                          color: t.text,
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {img.fileName}
                      </td>
                      <td style={{ padding: '10px 12px', color: t.textSecondary }}>
                        {img.width}×{img.height}
                      </td>
                      <td style={{ padding: '10px 12px', color: t.textMuted }}>
                        {formatDeletedTime(img.deletedAt ?? '')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleRestore(img.id)}
                          style={{
                            fontSize: 11,
                            fontFamily: t.fontDisplay,
                            color: t.success,
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
                                fontFamily: t.fontDisplay,
                                color: t.bg,
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
                                fontFamily: t.fontDisplay,
                                color: t.textSecondary,
                                background: 'none',
                                border: `1px solid ${t.border}`,
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
                              fontFamily: t.fontDisplay,
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
                    fontFamily: t.fontBody,
                    color: p === page ? t.bg : t.textSecondary,
                    background: p === page ? t.accent : 'transparent',
                    border: p === page ? 'none' : `1px solid ${t.border}`,
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
              background: t.bg,
              borderRadius: 6,
              padding: '24px 28px',
              maxWidth: 360,
              boxShadow: 'rgba(139, 115, 75, 0.12) 0px 0px 0px 1px, rgba(78, 50, 23, 0.12) 0px 8px 32px',
              fontFamily: t.fontBody,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                fontFamily: t.fontDisplay,
                color: t.text,
                margin: '0 0 8px',
              }}
            >
              清空回收站？
            </h3>
            <p style={{ fontSize: 12, color: t.textSecondary, margin: '0 0 20px', lineHeight: 1.5 }}>
              永久删除回收站中的所有 {total} 张图片，此操作不可撤销。
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmEmpty(false)}
                style={{
                  fontSize: 11,
                  fontFamily: t.fontDisplay,
                  color: t.textSecondary,
                  background: 'none',
                  border: `1px solid ${t.border}`,
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
                  fontFamily: t.fontDisplay,
                  color: t.bg,
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
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${t.border}`,
          marginTop: 'auto',
        }}
      >
        <span style={{ fontSize: 11, color: t.textSecondary, fontFamily: t.fontBody }}>
          {total} 张已删除图片
        </span>
        <span style={{ fontSize: 11, color: t.textSecondary, fontFamily: t.fontBody }}>
          第 {page} / {totalPages} 页
        </span>
      </div>
    </div>
  );
}

export default TrashPage;
