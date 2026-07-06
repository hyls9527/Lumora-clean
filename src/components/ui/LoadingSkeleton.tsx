import { t } from '../../lib/tokens';
/** 骨架屏占位块 */
function Bone({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background:
          'linear-gradient(90deg, rgba(139,115,75,0.06) 25%, rgba(139,115,75,0.12) 50%, rgba(139,115,75,0.06) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
        borderRadius: 2,
        ...style,
      }}
    />
  );
}

/** 图库网格骨架屏 */
export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div
        style={{
          columnCount: 4,
          columnGap: 12,
          padding: '24px 32px',
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <div
              style={{
                borderRadius: 2,
                overflow: 'hidden',
                background: 'var(--color-surface)',
                border: '1px solid rgba(139, 115, 75, 0.10)',
              }}
            >
              <Bone style={{ width: '100%', aspectRatio: '1' }} />
              <div style={{ padding: '8px 10px', background: t.bg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Bone style={{ width: 60, height: 11 }} />
                  <Bone style={{ width: 48, height: 11 }} />
                </div>
                <Bone style={{ width: '100%', height: 10, marginBottom: 4 }} />
                <Bone style={{ width: '60%', height: 10 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** 搜索结果骨架屏 */
export function SearchSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 2,
              overflow: 'hidden',
              background: 'var(--color-surface)',
              border: '1px solid rgba(139, 115, 75, 0.10)',
            }}
          >
            <Bone style={{ width: '100%', aspectRatio: '1' }} />
            <div style={{ padding: '12px 14px' }}>
              <Bone style={{ width: '100%', height: 12, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 12 }}>
                <Bone style={{ width: 60, height: 10 }} />
                <Bone style={{ width: 80, height: 10 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** 列表行骨架屏 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(139, 115, 75, 0.10)',
          borderRadius: 2,
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 16px',
              borderBottom:
                i < count - 1
                  ? '1px solid rgba(139, 115, 75, 0.10)'
                  : 'none',
            }}
          >
            <Bone style={{ width: 40, height: 40, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Bone style={{ width: '70%', height: 14, marginBottom: 6 }} />
              <Bone style={{ width: '40%', height: 12 }} />
            </div>
            <Bone style={{ width: 48, height: 12, flexShrink: 0 }} />
            <Bone style={{ width: 48, height: 18, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </>
  );
}
