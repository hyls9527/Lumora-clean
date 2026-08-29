import { useEffect, memo, useCallback } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useImageActions } from '../../hooks/useImageActions';
import type { ImageRecord } from '../../types/image';
import { useTrashStore } from '../../stores/trashStore';
import { useEmbeddingStore } from '../../stores/embeddingStore';
import { Rating } from './Rating';
import { TagBadge } from './TagBadge';
import { SimilarityBadge } from './SimilarityBadge';
import { EmbeddingBadge } from './EmbeddingBadge';
import { useImageSrc } from '../../hooks/useImageSrc';
import { t } from '../../lib/i18n';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface ImageCardProps {
  image: ImageRecord;
  onClick?: () => void;
  onOpen?: () => void;
  focused?: boolean;
  showSimilarity?: boolean;
}

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

  // Grid cards load a server-side resized thumbnail instead of the full
  // image: 640px covers ~320px masonry columns at 2x DPI. The DetailModal
  // opened from this card still loads the full-size image.
  const imgSrc = useImageSrc(image.filePath, { thumbnailMaxWidth: 640 });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!embeddingStatus) fetchStatus(image.id);
  }, [image.id, embeddingStatus, fetchStatus]);

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavorite(image.id);
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

  const cardClass = [
    'image-card',
    focused ? 'image-card--focused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const metaClass = `image-card__meta${isMobile ? ' image-card__meta--mobile' : ''}`;
  const modelClass = `image-card__model${isMobile ? ' image-card__model--mobile' : ''}`;
  const actionsClass = `image-card__actions${isMobile ? ' image-card__actions--mobile' : ''}`;
  const btnClass = `image-card__action-btn${isMobile ? ' image-card__action-btn--mobile' : ''}`;
  const promptClass = `image-card__prompt${isMobile ? ' image-card__prompt--mobile' : ''}`;
  const bodyClass = `image-card__body${isMobile ? ' image-card__body--mobile' : ''}`;
  const footerClass = `image-card__footer${isMobile ? ' image-card__footer--mobile' : ''}`;
  const tagsClass = `image-card__tags${isMobile ? ' image-card__tags--mobile' : ''}`;

  return (
    <div
      tabIndex={0}
      data-image-id={image.id}
      className={cardClass}
      onClick={onClick ?? onOpen}
      onFocus={(e) => {
        if (!focused) {
          e.currentTarget.style.boxShadow =
            'rgba(139,115,75,0.14) 0px 0px 0px 1px, rgba(78,50,23,0.08) 0px 4px 16px';
        }
      }}
      onBlur={(e) => {
        if (!focused) {
          e.currentTarget.style.boxShadow = '';
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow =
          'rgba(139,115,75,0.14) 0px 0px 0px 1px, rgba(78,50,23,0.08) 0px 4px 16px, rgba(78,50,23,0.04) 0px 1px 4px';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Image preview area */}
      <div
        className="image-card__preview"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={image.fileName}
            loading="lazy"
          />
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
      </div>

      {/* Card body */}
      <div className={bodyClass}>
        {/* Model + Favorite + Rating */}
        <div className={metaClass}>
          <span className={modelClass}>{image.model}</span>
          <div className={actionsClass}>
            <button
              type="button"
              onClick={handleFavorite}
              className={`${btnClass}${image.favorite ? ' image-card__action-btn--active' : ''}`}
              aria-label={image.favorite ? t('common.unfavorite') : t('common.favorite')}
            >
              ◆
            </button>
            <Rating value={image.rating} onChange={handleRatingChange} />
            <button
              type="button"
              onClick={handleDelete}
              className={btnClass}
              aria-label={t('common.delete')}
              title={t('common.moveToTrash')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Prompt excerpt */}
        <p className={promptClass}>{image.prompt}</p>

        {/* Tags + Embedding badge */}
        <div className={footerClass}>
          <div className={tagsClass}>
            {image.tags.map((tag) => (
              <TagBadge key={tag} name={tag} />
            ))}
          </div>
          {embeddingStatus && <EmbeddingBadge status={embeddingStatus.status} />}
        </div>
      </div>
    </div>
  );
});
