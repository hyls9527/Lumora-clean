import { useEffect, useState, useCallback } from 'react';
import { useImageActions } from '../../hooks/useImageActions';
import type { ImageRecord } from '../../types/image';
import { ImageCard } from '../../components/ui/ImageCard';
import { DetailModal } from '../../components/ui/DetailModal';
import { listFavorites } from '../../lib/api/images';
import { ErrorState } from '../../components/ui/ErrorState';

export function FavoritesPage() {
  const { toggleFavorite, setRating } = useImageActions();

  const [favorites, setFavorites] = useState<ImageRecord[]>([]);
  const [detailImage, setDetailImage] = useState<ImageRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listFavorites();
      setFavorites(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载收藏失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  // Close modal if current image is no longer in favorites
  useEffect(() => {
    if (detailImage && !favorites.find((f) => f.id === detailImage.id)) {
      setDetailImage(null);
    }
  }, [favorites, detailImage]);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      toggleFavorite(id);
      // Refresh favorites list after toggle
      setTimeout(() => { void loadFavorites(); }, 100);
    },
    [toggleFavorite, loadFavorites],
  );

  const handleDetailPrev = useCallback(() => {
    setDetailImage((prev: ImageRecord | null) => {
      if (!prev) return prev;
      const idx = favorites.findIndex((i) => i.id === prev.id);
      if (idx < 0) return null;
      const nextIdx = Math.max(0, idx - 1);
      return favorites[nextIdx] ?? null;
    });
  }, [favorites]);

  const handleDetailNext = useCallback(() => {
    setDetailImage((prev: ImageRecord | null) => {
      if (!prev) return prev;
      const idx = favorites.findIndex((i) => i.id === prev.id);
      if (idx < 0) return null;
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
      {error ? (
        <ErrorState message={error} onRetry={loadFavorites} />
      ) : loading ? (
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
          加载中…
        </div>
      ) : favorites.length === 0 ? (
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
        onToggleFavorite={handleToggleFavorite}
        onSetRating={setRating}
      />
    </div>
  );
}

export default FavoritesPage;
