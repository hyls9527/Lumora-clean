import { useEffect } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { ImageCard } from '../../components/ui/ImageCard';
import { GridSkeleton } from '../../components/ui/LoadingSkeleton';
import { ErrorState } from '../../components/ui/ErrorState';

const sortOptions = [
  { key: 'time' as const, label: '生成时间 ↓' },
  { key: 'rating' as const, label: '评分' },
  { key: 'model' as const, label: '模型' },
  { key: 'size' as const, label: '尺寸' },
];

const modelFilters = ['all', 'SDXL 1.0', 'Flux', 'Midjourney', 'ComfyUI'];

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-display)',
        color: active ? '#7a5c12' : '#6b5d48',
        background: 'none',
        border: 'none',
        padding: '0 0 2px',
        borderBottom: `2px solid ${active ? '#7a5c12' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'color 200ms, border-color 200ms',
      }}
    >
      {children}
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-display)',
        color: active ? '#f2ede4' : '#6b5d48',
        background: active ? '#7a5c12' : 'transparent',
        border: active ? 'none' : '1px solid rgba(139, 115, 75, 0.10)',
        padding: '4px 12px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'background 200ms, color 200ms',
      }}
    >
      {children}
    </button>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-display)',
        color: active ? '#7a5c12' : '#6b5d48',
        background: 'none',
        border: 'none',
        padding: '0 0 2px',
        borderBottom: `2px solid ${active ? '#7a5c12' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'color 200ms',
      }}
    >
      {children}
    </button>
  );
}

export function GalleryPage() {
  const {
    filters,
    setSortBy,
    setModelFilter,
    setView,
    selectedIds,
    getFilteredImages,
    loading,
    error,
    fetchImages,
    page,
    total,
    perPage,
  } = useImageStore();

  const images = getFilteredImages();
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    fetchImages(1);
  }, [fetchImages]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '14px 32px',
          background: 'var(--color-bg)',
          borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
        }}
      >
        {/* Row 1 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: '#2a2118',
                margin: 0,
              }}
            >
              创作者图库
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ViewButton
              active={filters.view === 'grid'}
              onClick={() => setView('grid')}
            >
              网格
            </ViewButton>
            <ViewButton
              active={filters.view === 'list'}
              onClick={() => setView('list')}
            >
              列表
            </ViewButton>
          </div>
        </div>

        {/* Row 2: Sort + Model filter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {sortOptions.map((opt) => (
              <SortButton
                key={opt.key}
                active={filters.sortBy === opt.key}
                onClick={() => setSortBy(opt.key)}
              >
                {opt.label}
              </SortButton>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {modelFilters.map((m) => (
              <FilterButton
                key={m}
                active={filters.modelFilter === m}
                onClick={() => setModelFilter(m)}
              >
                {m === 'all' ? '全部' : m}
              </FilterButton>
            ))}
          </div>
        </div>
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
              background: loading ? '#a09480' : '#4a7a3a',
            }}
          />
          <span
            style={{ fontSize: 10, color: loading ? '#a09480' : '#4a7a3a', fontFamily: 'var(--font-body)' }}
          >
            {loading ? '加载中…' : '数据库已连接'}
          </span>
        </div>
        <span
          style={{ fontSize: 10, color: '#a09480', fontFamily: 'var(--font-body)' }}
        >
          共 {total} 张
        </span>
      </div>

      {/* Error state */}
      {error && !loading && (
        <ErrorState message={error} onRetry={() => fetchImages(page)} />
      )}

      {/* Content */}
      {loading ? (
        <GridSkeleton count={8} />
      ) : !error ? (
        <>
          {/* Image Grid (Masonry via CSS columns) */}
          <div
            style={{
              columnCount: filters.view === 'grid' ? 4 : 1,
              columnGap: 12,
              padding: '24px 32px',
            }}
          >
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  breakInside: 'avoid',
                  marginBottom: 12,
                }}
              >
                <ImageCard image={img} />
              </div>
            ))}
          </div>

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
                  onClick={() => fetchImages(p)}
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
        <span
          style={{ fontSize: 11, color: '#6b5d48', fontFamily: 'var(--font-body)' }}
        >
          {selectedIds.size > 0
            ? `已选 ${selectedIds.size} 张`
            : `${images.length} 张作品`}
        </span>
        <span
          style={{ fontSize: 11, color: '#6b5d48', fontFamily: 'var(--font-body)' }}
        >
          第 {page} / {totalPages} 页
        </span>
      </div>
    </div>
  );
}
