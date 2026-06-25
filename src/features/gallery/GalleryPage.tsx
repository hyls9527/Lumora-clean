import { useEffect, useState, useCallback, useRef } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useTrashStore } from '../../stores/trashStore';
import { ImageCard } from '../../components/ui/ImageCard';
import { DetailModal } from '../../components/ui/DetailModal';
import { GridSkeleton } from '../../components/ui/LoadingSkeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';

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
    toggleFavorite,
    setRating,
    toggleSelect,
    clearSelection,
    page,
    total,
    perPage,
  } = useImageStore();
  const softDelete = useTrashStore((s) => s.softDeleteImage);

  const images = getFilteredImages();
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Keyboard nav state
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [detailImage, setDetailImage] = useState<ReturnType<typeof getFilteredImages>[0] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchImages(1);
  }, [fetchImages]);

  // Scroll focused card into view
  useEffect(() => {
    if (focusedIndex < 0 || !gridRef.current) return;
    const card = gridRef.current.querySelector(
      `[data-image-id="${images[focusedIndex]?.id}"]`,
    ) as HTMLElement | null;
    card?.focus();
  }, [focusedIndex, images]);

  const handleArrowUp = useCallback(() => {
    setFocusedIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleArrowDown = useCallback(() => {
    setFocusedIndex((prev) => Math.min(images.length - 1, prev + 1));
  }, [images.length]);

  const handleArrowLeft = useCallback(() => {
    // In grid view, jump one column left (approx 4 columns)
    setFocusedIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleArrowRight = useCallback(() => {
    setFocusedIndex((prev) => Math.min(images.length - 1, prev + 1));
  }, [images.length]);

  const handleEnter = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < images.length) {
      setDetailImage(images[focusedIndex]);
    }
  }, [focusedIndex, images]);

  const handleSpace = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < images.length) {
      toggleSelect(images[focusedIndex].id);
    }
  }, [focusedIndex, images, toggleSelect]);

  const handleEscape = useCallback(() => {
    if (selectedIds.size > 0) {
      clearSelection();
    }
    setFocusedIndex(-1);
  }, [selectedIds.size, clearSelection]);

  const handleDelete = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < images.length) {
      softDelete(images[focusedIndex].id).then(() => fetchImages());
    }
  }, [focusedIndex, images, softDelete, fetchImages]);

  const handleFavorite = useCallback(() => {
    if (focusedIndex >= 0 && focusedIndex < images.length) {
      toggleFavorite(images[focusedIndex].id);
    }
  }, [focusedIndex, images, toggleFavorite]);

  const handleRate = useCallback(
    (rating: number) => {
      if (focusedIndex >= 0 && focusedIndex < images.length) {
        setRating(images[focusedIndex].id, rating);
      }
    },
    [focusedIndex, images, setRating],
  );

  const handleDetailPrev = useCallback(() => {
    setDetailImage((prev) => {
      if (!prev) return prev;
      const idx = images.findIndex((i) => i.id === prev.id);
      const nextIdx = Math.max(0, idx - 1);
      return images[nextIdx] ?? prev;
    });
  }, [images]);

  const handleDetailNext = useCallback(() => {
    setDetailImage((prev) => {
      if (!prev) return prev;
      const idx = images.findIndex((i) => i.id === prev.id);
      const nextIdx = Math.min(images.length - 1, idx + 1);
      return images[nextIdx] ?? prev;
    });
  }, [images]);

  useKeyboardNav({
    route: '/gallery',
    onArrowUp: handleArrowUp,
    onArrowDown: handleArrowDown,
    onArrowLeft: handleArrowLeft,
    onArrowRight: handleArrowRight,
    onEnter: handleEnter,
    onSpace: handleSpace,
    onEscape: handleEscape,
    onDelete: handleDelete,
    onFavorite: handleFavorite,
    onRate: handleRate,
  });

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
            ref={gridRef}
            style={{
              columnCount: filters.view === 'grid' ? 4 : 1,
              columnGap: 12,
              padding: '24px 32px',
            }}
          >
            {images.map((img, index) => (
              <div
                key={img.id}
                style={{
                  breakInside: 'avoid',
                  marginBottom: 12,
                }}
              >
                <ImageCard
                  image={img}
                  focused={focusedIndex === index}
                  onOpen={() => setDetailImage(img)}
                  onClick={() => setFocusedIndex(index)}
                />
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

      {/* Detail Modal */}
      <DetailModal
        image={detailImage}
        onClose={() => setDetailImage(null)}
        onPrev={handleDetailPrev}
        onNext={handleDetailNext}
        onToggleFavorite={toggleFavorite}
        onSetRating={setRating}
      />
    </div>
  );
}
