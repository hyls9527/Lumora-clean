import { useEffect, useState, useCallback, useMemo } from 'react';
import { useImageStore } from '../../stores/imageStore';
import type { ImageRecord } from '../../types/image';
import { ImageCard } from '../../components/ui/ImageCard';
import { DetailModal } from '../../components/ui/DetailModal';

export function FavoritesPage() {
  const images = useImageStore((s) => s.images);
  const fetchImages = useImageStore((s) => s.fetchImages);
  const toggleFavorite = useImageStore((s) => s.toggleFavorite);
  const setRating = useImageStore((s) => s.setRating);

  const [detailImage, setDetailImage] = useState<ImageRecord | null>(null);

  // Fix #6: memoize filtered favorites
  const favorites = useMemo(() => images.filter((img) => img.favorite), [images]);

  useEffect(() => {
    fetchImages(1);
  }, [fetchImages]);

  // Fix #2: close modal if current image is no longer in favorites
  useEffect(() => {
    if (detailImage && !favorites.find((f) => f.id === detailImage.id)) {
      setDetailImage(null);
    }
  }, [favorites, detailImage]);

  const handleDetailPrev = useCallback(() => {
    setDetailImage((prev: ImageRecord | null) => {
      if (!prev) return prev;
      const idx = favorites.findIndex((i) => i.id === prev.id);
      if (idx < 0) return null; // Fix #2: not found → close
      const nextIdx = Math.max(0, idx - 1);
      return favorites[nextIdx] ?? null;
    });
  }, [favorites]);

  const handleDetailNext = useCallback(() => {
    setDetailImage((prev: ImageRecord | null) => {
      if (!prev) return prev;
      const idx = favorites.findIndex((i) => i.id === prev.id);
      if (idx < 0) return null; // Fix #2: not found → close
      const nextIdx = Math.min(favorites.length - 1, idx + 1);
      return favorites[nextIdx] ?? null;
    });
  }, [favorites]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 32px',
          borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
          background: 'var(--color-bg)',
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: '#2a2118',
            margin: 0,
          }}
        >
          收藏
        </h2>
      </div>

      {/* Content */}
      {favorites.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a09480',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
          }}
        >
          暂无收藏图片
        </div>
      ) : (
        <div
          style={{
            columnCount: 4,
            columnGap: 12,
            padding: '24px 32px',
          }}
        >
          {favorites.map((img) => (
            <div
              key={img.id}
              style={{ breakInside: 'avoid', marginBottom: 12 }}
            >
              <ImageCard
                image={img}
                onOpen={() => setDetailImage(img)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div
        style={{
          padding: '14px 32px',
          borderTop: '1px solid rgba(139, 115, 75, 0.10)',
          marginTop: 'auto',
        }}
      >
        <span
          style={{ fontSize: 11, color: '#6b5d48', fontFamily: 'var(--font-body)' }}
        >
          {favorites.length} 张收藏
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

export default FavoritesPage;
