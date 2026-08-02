/**
 * Offline notification banner.
 * Shows a non-intrusive bar at the top of the viewport when the network is lost.
 * Auto-hides when connectivity is restored.
 */

import { useState, useEffect } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { t } from '../../lib/tokens';

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Show with a short delay to avoid flickering on brief disconnects
  useEffect(() => {
    if (isOnline) {
      setVisible(false);
      setDismissed(false);
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isOnline]);

  if (isOnline || !visible || dismissed) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '10px 16px',
        fontSize: 12,
        fontFamily: t.fontBody,
        color: '#fff',
        background: 'rgba(180, 60, 40, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.3)',
        animation: 'lumora-slide-down 250ms ease-out',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>网络连接已断开 — 部分功能可能受限</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="关闭通知"
        style={{
          marginLeft: 'auto',
          padding: '2px 6px',
          fontSize: 11,
          fontFamily: t.fontBody,
          color: 'rgba(255,255,255,0.85)',
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 3,
          cursor: 'pointer',
          lineHeight: '18px',
        }}
      >
        知道了
      </button>
    </div>
  );
}
