import { t } from '../../lib/tokens';
interface DropOverlayProps {
  isVisible: boolean;
}

/**
 * DropOverlay — visual overlay when files are dragged over the window.
 * Follows DESIGN.md: 200ms transition, warm tones.
 */
export function DropOverlay({ isVisible }: DropOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(242, 237, 228, 0.9)',
        backdropFilter: 'blur(4px)',
        transition: 'opacity 200ms ease-out',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '48px 64px',
          borderRadius: 6,
          border: '2px dashed #7a5c12',
          background: 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <div
          style={{
            fontSize: 32,
            color: t.accent,
          }}
        >
          ↓
        </div>
        <div
          style={{
            fontSize: 16,
            fontFamily: t.fontDisplay,
            color: t.text,
          }}
        >
          松开以导入图片
        </div>
        <div
          style={{
            fontSize: 12,
            fontFamily: t.fontBody,
            color: t.textMuted,
          }}
        >
          支持文件和文件夹
        </div>
      </div>
    </div>
  );
}
