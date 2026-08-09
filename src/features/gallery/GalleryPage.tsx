import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useSelection } from '../../hooks/useSelection';
import { useImageActions } from '../../hooks/useImageActions';
import { useTrashStore } from '../../stores/trashStore';
import { useToastStore } from '../../stores/toastStore';
import { useImageSearchStore } from '../../stores/imageSearchStore';
import { usePerformanceMonitor } from '../../hooks/usePerformance';
import { ImageCard } from '../../components/ui/ImageCard';
import { FilterPanel } from '../../components/ui/FilterPanel';
import { DetailModal } from '../../components/ui/DetailModal';
import { GridSkeleton } from '../../components/ui/LoadingSkeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { LazyLoad } from '../../components/ui/LazyLoad';
import { InfiniteScroll } from '../../components/ui/InfiniteScroll';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { batchAutoTag } from '../../lib/api/ai';
import { useEmbeddingStore } from '../../stores/embeddingStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTranslation } from '../../lib/i18n';
import { TabButton } from '../../components/ui/TabButton';
import { BatchToolbar } from './BatchToolbar';
import { RenameDialog } from '../../components/rename/RenameDialog';
import { ConvertDialog } from '../../components/convert/ConvertDialog';
import { useFilterStore } from '../../stores/filterStore';
import { t as tokens, navTabStyle, separatorStyle, dotStyle, pageTitleStyle } from '../../lib/tokens';

const sortOptions = [
  { key: 'time' as const, label: '生成时间 ↓' },
  { key: 'rating' as const, label: '评分' },
  { key: 'model' as const, label: '模型' },
  { key: 'size' as const, label: '尺寸' },
];

const modelFilters = ['all', 'SDXL 1.0', 'Flux', 'Midjourney', 'ComfyUI'];

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
  const batchSoftDelete = useTrashStore((s) => s.batchSoftDelete);
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [renameOpen, setRenameOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  usePerformanceMonitor('GalleryPage');

  const [batchDeleting, setBatchDeleting] = useState(false);
  const filterCriteria = useFilterStore((s) => s.criteria);
  const [batchTagging, setBatchTagging] = useState(false);
  const [batchEmbedding, setBatchEmbedding] = useState(false);
  const [columnCount, setColumnCount] = useState(0); // 0 = auto (CSS responsive)

  const images = getFilteredImages();
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Keyboard nav state
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [detailImage, setDetailImage] = useState<ReturnType<typeof getFilteredImages>[0] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Use ref to hold images to avoid callback recreation
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Refetch when filters change (debounced so typing in the panel doesn't spam)
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchImages(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterCriteria, fetchImages]);

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
    } catch (err) {
      useToastStore.getState().addToast(
        'error',
        err instanceof Error ? err.message : '批量删除失败',
      );
    } finally {
      setBatchDeleting(false);
    }
  }, [selectedIds, clearSelection, fetchImages, page]);

  const handleBatchTag = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBatchTagging(true);
    try {
      await batchAutoTag([...selectedIds]);
      clearSelection();
      await fetchImages(page);
    } catch {
      // error handled by batchAutoTag
    } finally {
      setBatchTagging(false);
    }
  }, [selectedIds, clearSelection, fetchImages, page]);

  const handleBatchEmbed = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBatchEmbedding(true);
    try {
      const selected = images.filter((img) => selectedIds.has(img.id));
      await useEmbeddingStore.getState().generate(selected);
      clearSelection();
    } catch {
      // error handled by embeddingStore
    } finally {
      setBatchEmbedding(false);
    }
  }, [selectedIds, clearSelection, images]);

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

  // Listen for variant selection events from DetailModal
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setDetailImage(detail);
    };
    window.addEventListener('lumora:selectImage', handler);
    return () => window.removeEventListener('lumora:selectImage', handler);
  }, []);

  useKeyboardNav({
    route: '/gallery',
    activeStage: detailImage ? 'detail' : 'browse',
    stages: [
      {
        id: 'browse',
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
      },
      {
        id: 'detail',
        onArrowLeft: handleDetailPrev,
        onArrowRight: handleDetailNext,
        onEscape: () => setDetailImage(null),
        onDelete: handleDelete,
        onFavorite: handleFavorite,
        onRate: handleRate,
      },
    ],
  });

  // 必须在顶层无条件调用（不能放进 JSX 条件分支，否则有数据时 hooks 数量变化导致崩溃）
  const renderedCards = useMemo(
    () =>
      images.map((img, index) => (
        <div
          key={img.id}
          style={{
            breakInside: 'avoid',
            marginBottom: 12,
          }}
        >
          <LazyLoad height={img.height || 200}>
            <ImageCard
              image={img}
              focused={focusedIndex === index}
              onOpen={() => setDetailImage(img)}
              onClick={() => setFocusedIndex(index)}
            />
          </LazyLoad>
        </div>
      )),
    [images, focusedIndex],
  );

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
          borderBottom: `1px solid ${tokens.border}`,
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
            <h2 style={pageTitleStyle(isMobile)}>
              创作者图库
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setColumnCount(columnCount === n ? 0 : n)}
                  style={navTabStyle(columnCount === n)}
                  title={`${n}列`}
                >
                  {n}列
                </button>
              ))}
              <span style={separatorStyle} />
            <TabButton
              active={filters.view === 'grid'}
              onClick={() => setView('grid')}
            >
              网格
            </TabButton>
            <TabButton
              active={filters.view === 'list'}
              onClick={() => setView('list')}
            >
              列表
            </TabButton>
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
              <TabButton
                key={opt.key}
                active={filters.sortBy === opt.key}
                onClick={() => setSortBy(opt.key)}
              >
                {opt.label}
              </TabButton>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12, flexWrap: 'wrap' }}>
            {modelFilters.map((m) => (
              <TabButton
                key={m}
                active={filters.modelFilter === m}
                onClick={() => setModelFilter(m)}
              >
                {m === 'all' ? '全部' : m}
              </TabButton>
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
          borderBottom: `1px solid ${tokens.border}`,
          background: 'var(--color-bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={dotStyle(loading ? tokens.textMuted : tokens.success)} />
          <span
            style={{ fontSize: 10, color: loading ? tokens.textMuted : tokens.success, fontFamily: tokens.fontBody }}
          >
            {loading ? t('common.loadingMore') : t('common.dbConnected')}
          </span>
        </div>
        <span
          style={{ fontSize: 10, color: tokens.textMuted, fontFamily: tokens.fontBody }}
        >
          {t('common.totalImages', { total })}
        </span>
      </div>

      <FilterPanel />

      {/* Error state */}
      {error && !loading && (
        <ErrorState message={error} onRetry={() => fetchImages(page)} />
      )}

      {/* Content */}
      {loading ? (
        <GridSkeleton count={8} />
      ) : !error ? (
        images.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 16, textAlign: 'center', padding: '0 32px' }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="12" y="8" width="40" height="48" rx="3" stroke={tokens.textFaint} strokeWidth="1.5" fill="none" />
              <path d="M20 20h24M20 28h16M20 36h20" stroke={tokens.textFaint} strokeWidth="1" strokeLinecap="round" />
              <circle cx="44" cy="44" r="10" stroke={tokens.accent} strokeWidth="1.5" fill="rgba(122,92,18,0.06)" />
              <path d="M41 44l2 2 4-4" stroke={tokens.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 15, fontFamily: tokens.fontDisplay, color: 'var(--color-text-secondary)' }}>图库尚空</span>
            <span style={{ fontSize: 13, fontFamily: tokens.fontBody, color: 'var(--color-text-muted)' }}>导入图片，点亮属于你的灯火。</span>
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
              style={columnCount > 0 && filters.view === 'grid' ? { columnCount } : undefined}
            >
              {renderedCards}
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
                  key={`gallery-page-${p}`}
                  type="button"
                  onClick={() => fetchImages(p)}
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: 11,
                    fontFamily: tokens.fontBody,
                    color: p === page ? tokens.bg : tokens.textSecondary,
                    background: p === page ? tokens.accent : 'transparent',
                    border: p === page ? 'none' : `1px solid ${tokens.border}`,
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

      {/* Bottom bar — page info only */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${tokens.border}`,
          marginTop: 'auto',
        }}
      >
        <span style={{ fontSize: 11, color: tokens.textSecondary, fontFamily: tokens.fontBody }}>
          {t('common.artworks', { count: images.length })}
        </span>
        <span style={{ fontSize: 11, color: tokens.textSecondary, fontFamily: tokens.fontBody }}>
          {t('common.pageInfo', { page, totalPages })}
        </span>
      </div>

      {/* Floating batch toolbar */}
      <BatchToolbar
        count={selectedIds.size}
        onDelete={handleBatchDelete}
        onAiTag={handleBatchTag}
        onEmbed={handleBatchEmbed}
        onRename={() => setRenameOpen(true)}
        onConvert={() => setConvertOpen(true)}
        onCancel={clearSelection}
        deleting={batchDeleting}
        tagging={batchTagging}
        embedding={batchEmbedding}
      />

      {/* Rename Dialog */}
      <RenameDialog
        open={renameOpen}
        imageIds={[...selectedIds]}
        onClose={() => setRenameOpen(false)}
        onComplete={() => {
          setRenameOpen(false);
          clearSelection();
          fetchImages();
        }}
      />

      {/* Convert Dialog */}
      <ConvertDialog
        open={convertOpen}
        imageIds={[...selectedIds]}
        onClose={() => setConvertOpen(false)}
        onComplete={() => {
          setConvertOpen(false);
          clearSelection();
          fetchImages();
        }}
      />

      {/* Detail Modal */}
      <DetailModal
        image={detailImage}
        onClose={() => setDetailImage(null)}
        onPrev={handleDetailPrev}
        onNext={handleDetailNext}
        onToggleFavorite={toggleFavorite}
        onSetRating={setRating}
        onSearchSimilar={(id) => {
          const img = imagesRef.current.find((i) => i.id === id);
          if (img) {
            setDetailImage(null);
            useImageSearchStore.getState().search(img.id, img.filePath);
          }
        }}
      />
    </div>
  );
}

export default GalleryPage;
