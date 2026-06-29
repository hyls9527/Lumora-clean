/**
 * Update notification banner.
 * Shows at the bottom of the sidebar when a new version is available.
 */

import { useUpdater } from '../../hooks/useUpdater';

export function UpdateBanner() {
  const { available, checking, installing, downloaded, error, updateInfo, installUpdate } = useUpdater();

  if (checking || !available || downloaded) return null;

  return (
    <div
      role="alert"
      style={{
        margin: '0 12px 8px',
        padding: '8px 10px',
        fontSize: 10,
        fontFamily: 'var(--font-body)',
        background: 'rgba(122, 92, 18, 0.08)',
        border: '1px solid rgba(122, 92, 18, 0.15)',
        borderRadius: 4,
        color: '#7a5c12',
      }}
    >
      <div style={{ marginBottom: 4 }}>
        新版本 {updateInfo?.version ?? ''} 可用
      </div>
      <button
        type="button"
        onClick={installUpdate}
        disabled={installing}
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-display)',
          color: '#f2ede4',
          background: installing ? '#a09480' : '#7a5c12',
          border: 'none',
          borderRadius: 4,
          padding: '4px 12px',
          cursor: installing ? 'not-allowed' : 'pointer',
          transition: 'background 200ms',
        }}
      >
        {installing ? '安装中…' : '更新并重启'}
      </button>
      {error && (
        <div style={{ marginTop: 4, color: '#8b3030', fontSize: 9 }}>
          {error}
        </div>
      )}
    </div>
  );
}
