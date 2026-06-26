import { useEffect, memo } from 'react';
import { useImageStore, type ImageRecord } from '../../stores/imageStore';
import { useTrashStore } from '../../stores/trashStore';
import { useEmbeddingStore } from '../../stores/embeddingStore';
import { Rating } from './Rating';
import { TagBadge } from './TagBadge';
import { SimilarityBadge } from './SimilarityBadge';
import { EmbeddingBadge } from './EmbeddingBadge';

interface ImageCardProps {
  image: ImageRecord;
  onClick?: () => void;
  onOpen?: () => void;
  focused?: boolean;
  showSimilarity?: boolean;
}

export const ImageCard = memo(function ImageCard({ image, onClick, onOpen, focused, showSimilarity }: ImageCardProps) {
  const toggleFavorite = useImageStore((s) => s.toggleFavorite);
  const setRating = useImageStore((s) => s.setRating);
  const softDelete = useTrashStore((s) => s.softDeleteImage);
  const fetchImages = useImageStore((s) => s.fetchImages);
  const embeddingStatus = useEmbeddingStore((s) => s.statusMap[image.id]);
  const fetchStatus = useEmbeddingStore((s) => s.fetchStatus);

  useEffect(() => {
    if (!embeddingStatus) fetchStatus(image.id);
  }, [image.id, embeddingStatus, fetchStatus]);

  return (
    <div
      tabIndex={0}
      data-image-id={image.id}
      style={{
        borderRadius: '2px',
        cursor: 'pointer',
        background: 'var(--color-surface)',
        border: focused
          ? '2px solid #7a5c12'
          : '1px solid rgba(139, 115, 75, 0.10)',
        boxShadow:
          'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px',
        overflow: 'hidden',
        transition: 'box-shadow 200ms ease-out, border-color 200ms ease-out',
        outline: 'none',
      }}
      onClick={onClick ?? onOpen}
      onFocus={(e) => {
        if (!focused) {
          e.currentTarget.style.boxShadow =
            'rgba(139,115,75,0.14) 0px 0px 0px 1px, rgba(78,50,23,0.08) 0px 4px 16px';
        }
      }}
      onBlur={(e) => {
        if (!focused) {
          e.currentTarget.style.boxShadow =
            'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px';
        }
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          'rgba(139,115,75,0.14) 0px 0px 0px 1px, rgba(78,50,23,0.08) 0px 4px 16px';
      }}
      onMouseLeave={(e) => {
        if (!focused) {
          (e.currentTarget as HTMLElement).style.boxShadow =
            'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px';
        }
      }}
    >
      {/* Placeholder image area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${image.width} / ${image.height}`,
          background: 'rgba(139, 115, 75, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          color: '#a09480',
          fontFamily: 'var(--font-body)',
          borderRadius: '2px 2px 0 0',
        }}
      >
        {image.width}×{image.height}
        {showSimilarity && image.similarity != null && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <SimilarityBadge value={image.similarity} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '8px 10px', background: '#f2ede4' }}>
        {/* Model + Favorite + Rating */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: '#7a5c12',
              fontFamily: 'var(--font-display)',
            }}
          >
            {image.model}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(image.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '11px',
                color: image.favorite ? '#7a5c12' : '#c4b89e',
                transition: 'color 200ms',
                lineHeight: 1,
              }}
              aria-label={image.favorite ? '取消收藏' : '收藏'}
            >
              ◆
            </button>
            <Rating value={image.rating} onChange={(v) => setRating(image.id, v)} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                softDelete(image.id).then(() => fetchImages());
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '11px',
                color: '#c4b89e',
                transition: 'color 200ms',
                lineHeight: 1,
              }}
              aria-label="删除"
              title="移到回收站"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Prompt excerpt */}
        <p
          style={{
            fontSize: '10px',
            color: '#a09480',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            margin: 0,
          }}
        >
          {image.prompt}
        </p>

        {/* Tags + Embedding badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
