/**
 * Update notification banner.
 * Shows at the bottom of the sidebar when a new version is available:
 * version + release-notes preview, silent download progress, then a
 * "restart & install" action (or dismiss until later).
 */

import { useUpdater } from '../../hooks/useUpdater';
import { t } from '../../lib/tokens';

function bodyPreview(body: string): string {
  const MAX = 180;
  const trimmed = body.trim();
  return trimmed.length > MAX ? `${trimmed.slice(0, MAX)}…` : trimmed;
}

export function UpdateBanner() {
  const {
    available,
    checking,
    downloading,
    downloadProgress,
    installing,
    downloaded,
    dismissed,
    error,
    updateInfo,
    downloadUpdate,
    installNow,
    dismiss,
  } = useUpdater();

  if (checking || !available || dismissed) return null;

  const downloadingNow = downloading && !downloaded;
  const percent = downloadProgress != null ? Math.round(downloadProgress) : null;

  return (
    <div
      role="alert"
      style={{
        margin: '0 12px 8px',
        padding: '8px 10px',
        fontSize: 10,
        fontFamily: t.fontBody,
        background: 'rgba(122, 92, 18, 0.08)',
        border: '1px solid rgba(122, 92, 18, 0.15)',
        borderRadius: 4,
        color: t.accent,
      }}
    >
      <div style={{ marginBottom: 4 }}>
        新版本 {updateInfo?.version ?? ''} 可用
      </div>
      {updateInfo?.body && (
        <div
          style={{
            marginBottom: 6,
            fontSize: 9,
            lineHeight: 1.5,
            color: t.textSecondary,
            whiteSpace: 'pre-line',
          }}
        >
          {bodyPreview(updateInfo.body)}
        </div>
      )}
      {downloadingNow && (
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              height: 3,
              background: 'rgba(122, 92, 18, 0.15)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percent ?? 0}%`,
                background: t.accent,
                transition: 'width 200ms',
              }}
            />
          </div>
          <div style={{ marginTop: 3, fontSize: 9, color: t.textSecondary }}>
            {percent != null ? `正在下载 ${percent}%` : '正在下载…'}
          </div>
        </div>
      )}
      {downloaded && (
        <div style={{ marginBottom: 6, fontSize: 9, color: t.success }}>
          更新已下载，重启应用生效
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {downloaded ? (
          <button
            type="button"
            onClick={installNow}
            disabled={installing}
            style={{
              fontSize: 10,
              fontFamily: t.fontDisplay,
              color: t.bg,
              background: installing ? t.textMuted : t.accent,
              border: 'none',
              borderRadius: 4,
              padding: '4px 12px',
              cursor: installing ? 'not-allowed' : 'pointer',
              transition: 'background 200ms',
            }}
          >
            {installing ? '安装中…' : '重启并安装'}
          </button>
        ) : (
          <button
            type="button"
            onClick={downloadUpdate}
            disabled={downloadingNow}
            style={{
              fontSize: 10,
              fontFamily: t.fontDisplay,
              color: t.bg,
              background: downloadingNow ? t.textMuted : t.accent,
              border: 'none',
              borderRadius: 4,
              padding: '4px 12px',
              cursor: downloadingNow ? 'not-allowed' : 'pointer',
              transition: 'background 200ms',
            }}
          >
            {error ? '重试下载' : '下载更新'}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          style={{
            fontSize: 10,
            fontFamily: t.fontBody,
            color: t.textSecondary,
            background: 'none',
            border: 'none',
            borderRadius: 4,
            padding: '4px 6px',
            cursor: 'pointer',
          }}
        >
          稍后
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 4, color: t.danger, fontSize: 9 }}>
          {error}
        </div>
      )}
    </div>
  );
}
