import { useEffect, useState, useCallback, useRef } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useSelection } from '../../hooks/useSelection';
import { useImageActions } from '../../hooks/useImageActions';
import { useTrashStore } from '../../stores/trashStore';
import { ImageCard } from '../../components/ui/ImageCard';
import { DetailModal } from '../../components/ui/DetailModal';
import { GridSkeleton } from '../../components/ui/LoadingSkeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { LazyLoad } from '../../components/ui/LazyLoad';
import { InfiniteScroll } from '../../components/ui/InfiniteScroll';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { batchSoftDelete } from '../../lib/api/images';
import { useIsMobile } from '../../hooks/useMediaQuery';

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
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        background: 'none',
        border: 'none',
        padding: '0 0 2px',
        borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'color 200ms, border-color 200ms',
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
    getFilteredImages,
    loading,
    error,
    fetchImages,
    loadMore,
    page,
    total,
    perPage,
  } = useImageStore();
  const { selectedIds, toggleSelect, clearSelection } = useSelection();
  const { toggleFavorite, setRating } = useImageActions();
  const softDelete = useTrashStore((s) => s.softDeleteImage);
  const isMobile = useIsMobile();

  const [batchDeleting, setBatchDeleting] = useState(false);

  const images = getFilteredImages();
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Keyboard nav state
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [detailImage, setDetailImage] = useState<ReturnType<typeof getFilteredImages>[0] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Use ref to hold images to avoid callback recreation
  const imagesRef = useRef(images);
  imagesRef.current = images;

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
    setFocusedIndex((prev) => Math.min(imagesRef.current.length - 1, prev + 1));
  }, []);

  const handleArrowLeft = useCallback(() => {
    // In grid view, jump one column left (approx 4 columns)
    setFocusedIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleArrowRight = useCallback(() => {
    setFocusedIndex((prev) => Math.min(imagesRef.current.length - 1, prev + 1));
  }, []);

  const handleEnter = useCallback(() => {
    const imgs = imagesRef.current;
    if (focusedIndex >= 0 && focusedIndex < imgs.length) {
      setDetailImage(imgs[focusedIndex]);
    }
  }, [focusedIndex]);

  const handleSpace = useCallback(() => {
    const imgs = imagesRef.current;
    if (focusedIndex >= 0 && focusedIndex < imgs.length) {
      toggleSelect(imgs[focusedIndex].id);
    }
  }, [focusedIndex, toggleSelect]);

  const handleEscape = useCallback(() => {
    if (selectedIds.size > 0) {
      clearSelection();
    }
    setFocusedIndex(-1);
  }, [selectedIds.size, clearSelection]);

  const handleDelete = useCallback(() => {
    const imgs = imagesRef.current;
    if (focusedIndex >= 0 && focusedIndex < imgs.length) {
      softDelete(imgs[focusedIndex].id)
        .then(() => fetchImages())
        .catch((err) => console.error('Failed to delete image:', { id: imgs[focusedIndex].id, err }));
    }
  }, [focusedIndex, softDelete, fetchImages]);

  const handleFavorite = useCallback(() => {
    const imgs = imagesRef.current;
    if (focusedIndex >= 0 && focusedIndex < imgs.length) {
      toggleFavorite(imgs[focusedIndex].id);
    }
  }, [focusedIndex, toggleFavorite]);

  const handleRate = useCallback(
    (rating: number) => {
      const imgs = imagesRef.current;
      if (focusedIndex >= 0 && focusedIndex < imgs.length) {
        setRating(imgs[focusedIndex].id, rating);
      }
    },
    [focusedIndex, setRating],
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    try {
      await batchSoftDelete([...selectedIds]);
      clearSelection();
      await fetchImages(page);
    } catch {
      // error handled by store
    } finally {
      setBatchDeleting(false);
    }
  }, [selectedIds, clearSelection, fetchImages, page]);

  const handleDetailPrev = useCallback(() => {
    setDetailImage((prev) => {
      if (!prev) return prev;
      const imgs = imagesRef.current;
      const idx = imgs.findIndex((i) => i.id === prev.id);
      const nextIdx = Math.max(0, idx - 1);
      return imgs[nextIdx] ?? prev;
    });
  }, []);

  const handleDetailNext = useCallback(() => {
    setDetailImage((prev) => {
      if (!prev) return prev;
      const imgs = imagesRef.current;
      const idx = imgs.findIndex((i) => i.id === prev.id);
      const nextIdx = Math.min(imgs.length - 1, idx + 1);
      return imgs[nextIdx] ?? prev;
    });
  }, []);

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
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '12px 16px',
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
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h2
              style={{
                fontSize: isMobile ? 18 : 20,
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
            flexWrap: 'wrap',
            gap: '8px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 16, flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12, flexWrap: 'wrap' }}>
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
          padding: '8px 16px',
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
        images.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 12, textAlign: 'center', padding: '0 32px' }}>
            <span style={{ fontSize: 15, fontFamily: 'var(--font-display)', color: 'var(--color-text-secondary)' }}>图库尚空</span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>导入图片，点亮属于你的灯火。</span>
          </div>
        ) : (
          <>
          {/* Image Grid (Masonry via CSS columns) */}
          <InfiniteScroll
            onLoadMore={loadMore}
            hasMore={images.length < total}
            loading={loading}
          >
            <div
              ref={gridRef}
              className={filters.view === 'grid' ? 'gallery-grid' : 'gallery-list'}
            >
              {images.map((img, index) => (
                <div
                  key={img.id}
                  style={{
                    breakInside: 'avoid',
                    marginBottom: 12,
                  }}
                >
                  <LazyLoad height={200}>
                    <ImageCard
                      image={img}
                      focused={focusedIndex === index}
                      onOpen={() => setDetailImage(img)}
                      onClick={() => setFocusedIndex(index)}
                    />
                  </LazyLoad>
                </div>
              ))}
            </div>
          </InfiniteScroll>

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
        )
      ) : null}

      {/* Bottom bar */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(139, 115, 75, 0.10)',
          marginTop: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{ fontSize: 11, color: '#6b5d48', fontFamily: 'var(--font-body)' }}
          >
            {selectedIds.size > 0
              ? `已选 ${selectedIds.size} 张`
              : `${images.length} 张作品`}
          </span>
          {selectedIds.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={batchDeleting}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-display)',
                  color: '#b33a3a',
                  background: 'none',
                  border: '1px solid rgba(179, 58, 58, 0.2)',
                  padding: '4px 12px',
                  borderRadius: 4,
                  cursor: batchDeleting ? 'not-allowed' : 'pointer',
                  opacity: batchDeleting ? 0.5 : 1,
                  transition: 'background 200ms',
                }}
              >
                {batchDeleting ? '删除中…' : '批量删除'}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-display)',
                  color: '#6b5d48',
                  background: 'none',
                  border: '1px solid rgba(139, 115, 75, 0.10)',
                  padding: '4px 12px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'background 200ms',
                }}
              >
                取消选择
              </button>
            </>
          )}
        </div>
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
