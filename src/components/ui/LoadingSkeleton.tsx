import { t as tok } from '../../lib/tokens';

/** 骨架屏占位块 */
function Bone({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background:
          'linear-gradient(90deg, rgba(122,92,40,0.05) 25%, rgba(122,92,40,0.10) 50%, rgba(122,92,40,0.05) 75%)',
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
        className="gallery-grid"
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <div
              style={{
                borderRadius: 2,
                overflow: 'hidden',
                background: tok.surface,
                border: `1px solid ${tok.border}`,
                boxShadow: tok.shadow,
              }}
            >
              <Bone style={{ width: '100%', aspectRatio: '1' }} />
              <div style={{ padding: '10px 12px 12px', background: tok.surface, borderTop: `1px solid ${tok.borderSubtle}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
          padding: '16px 20px 8px',
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 2,
              overflow: 'hidden',
              background: tok.surface,
              border: `1px solid ${tok.border}`,
              boxShadow: tok.shadow,
            }}
          >
            <Bone style={{ width: '100%', aspectRatio: '1' }} />
            <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${tok.borderSubtle}` }}>
              <Bone style={{ width: '40%', height: 11, marginBottom: 8 }} />
              <Bone style={{ width: '80%', height: 10 }} />
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
          border: `1px solid ${tok.border}`,
          borderRadius: 2,
          margin: '16px 20px',
          background: tok.surface,
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
              borderBottom: i < count - 1 ? `1px solid ${tok.borderSubtle}` : 'none',
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
