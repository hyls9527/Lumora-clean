import { useEffect, memo, useCallback } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useImageActions } from '../../hooks/useImageActions';
import type { ImageRecord } from '../../types/image';
import { useTrashStore } from '../../stores/trashStore';
import { useEmbeddingStore } from '../../stores/embeddingStore';
import { Rating } from './Rating';
import { SimilarityBadge } from './SimilarityBadge';
import { useImageSrc } from '../../hooks/useImageSrc';
import { t } from '../../lib/i18n';

interface ImageCardProps {
  image: ImageRecord;
  onClick?: () => void;
  onOpen?: () => void;
  focused?: boolean;
  showSimilarity?: boolean;
}

/**
 * 灯箱印样：默认只有图。模型/操作在 hover 或键盘聚焦时从底部墨条浮现。
 * 收藏印与评分印作为角标常驻（墨色）；确认时才闪灯影。
 */
export const ImageCard = memo(function ImageCard({
  image,
  onClick,
  onOpen,
  focused,
  showSimilarity,
}: ImageCardProps) {
  const { toggleFavorite, setRating } = useImageActions();
  const softDelete = useTrashStore((s) => s.softDeleteImage);
  const fetchImages = useImageStore((s) => s.fetchImages);
  const embeddingStatus = useEmbeddingStore((s) => s.statusMap[image.id]);
  const fetchStatus = useEmbeddingStore((s) => s.fetchStatus);

  const imgSrc = useImageSrc(image.filePath, { thumbnailMaxWidth: 640 });

  useEffect(() => {
    if (!embeddingStatus) fetchStatus(image.id);
  }, [image.id, embeddingStatus, fetchStatus]);

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavorite(image.id);
      const card = e.currentTarget.closest('.image-card') as HTMLElement | null;
      if (card) {
        card.classList.remove('image-card--lantern');
        void card.offsetWidth;
        card.classList.add('image-card--lantern');
        window.setTimeout(() => card.classList.remove('image-card--lantern'), 520);
      }
    },
    [image.id, toggleFavorite],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      softDelete(image.id).then(() => fetchImages());
    },
    [image.id, softDelete, fetchImages],
  );

  const handleRatingChange = useCallback(
    (v: number) => setRating(image.id, v),
    [image.id, setRating],
  );

  const cardClass = ['image-card', focused ? 'image-card--focused' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      tabIndex={0}
      data-image-id={image.id}
      className={cardClass}
      onClick={onClick ?? onOpen}
      aria-label={image.model || image.fileName}
    >
      <div
        className="image-card__preview"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        {imgSrc ? (
          <img src={imgSrc} alt={image.fileName} loading="lazy" draggable={false} />
        ) : (
          <span className="image-card__placeholder">
            {image.width}×{image.height}
          </span>
        )}

        {showSimilarity && image.similarity != null && (
          <div className="image-card__similarity">
            <SimilarityBadge value={image.similarity} />
          </div>
        )}

        {/* 角标：收藏印 / 评分印 — 常驻，墨色 */}
        {image.favorite && (
          <span className="image-card__stamp image-card__stamp--fav" aria-hidden>
            ◆
          </span>
        )}
        {image.rating > 0 && (
          <span className="image-card__stamp image-card__stamp--rate" aria-hidden>
            梅×{image.rating}
          </span>
        )}

        {/* 底部墨条：hover / focus 才现 */}
        <div className="image-card__chrome">
          <span className="image-card__chrome-model">{image.model}</span>
          <div className="image-card__chrome-actions">
            <button
              type="button"
              onClick={handleFavorite}
              className={`image-card__chrome-btn${image.favorite ? ' is-on' : ''}`}
              aria-label={image.favorite ? t('common.unfavorite') : t('common.favorite')}
              title={image.favorite ? t('common.unfavorite') : t('common.favorite')}
            >
              ◆
            </button>
            <Rating value={image.rating} onChange={handleRatingChange} />
            <button
              type="button"
              onClick={handleDelete}
              className="image-card__chrome-btn"
              aria-label={t('common.delete')}
              title={t('common.moveToTrash')}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
