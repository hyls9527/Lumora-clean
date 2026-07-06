import { useEffect, memo } from 'react';
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
import { t as tok } from '../../lib/tokens';

interface ImageCardProps {
  image: ImageRecord;
  onClick?: () => void;
  onOpen?: () => void;
  focused?: boolean;
  showSimilarity?: boolean;
}

export const ImageCard = memo(function ImageCard({ image, onClick, onOpen, focused, showSimilarity }: ImageCardProps) {
  const { toggleFavorite, setRating } = useImageActions();
  const softDelete = useTrashStore((s) => s.softDeleteImage);
  const fetchImages = useImageStore((s) => s.fetchImages);
  const embeddingStatus = useEmbeddingStore((s) => s.statusMap[image.id]);
  const fetchStatus = useEmbeddingStore((s) => s.fetchStatus);

  const imgSrc = useImageSrc(image.filePath);
  const isMobile = useIsMobile();

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
          ? `2px solid ${tok.accent}`
          : `1px solid ${tok.border}`,
        boxShadow:
          'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px',
        overflow: 'hidden',
        transition: 'box-shadow 200ms ease-out, border-color 200ms ease-out, transform 200ms ease-out',
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
          e.currentTarget.style.transform = '';
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow =
          'rgba(139,115,75,0.14) 0px 0px 0px 1px, rgba(78,50,23,0.08) 0px 4px 16px, rgba(78,50,23,0.04) 0px 1px 4px';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow =
          'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px';
      }}
    >
      {/* Image preview area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${image.width} / ${image.height}`,
          background: 'rgba(139, 115, 75, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '2px 2px 0 0',
          overflow: 'hidden',
        }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={image.fileName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            loading="lazy"
          />
        ) : (
          <span
            style={{
              fontSize: '11px',
              color: tok.textMuted,
              fontFamily: tok.fontBody,
            }}
          >
            {image.width}×{image.height}
          </span>
        )}
        {showSimilarity && image.similarity != null && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <SimilarityBadge value={image.similarity} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: isMobile ? '10px 12px' : '8px 10px', background: tok.bg }}>
        {/* Model + Favorite + Rating */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isMobile ? '6px' : '4px',
          }}
        >
          <span
            style={{
              fontSize: isMobile ? '12px' : '11px',
              color: tok.accent,
              fontFamily: tok.fontDisplay,
            }}
          >
            {image.model}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '4px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(image.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: isMobile ? '4px' : '0',
                cursor: 'pointer',
                fontSize: isMobile ? '14px' : '11px',
                color: image.favorite ? tok.accent : tok.textFaint,
                transition: 'color 200ms',
                lineHeight: 1,
                minWidth: isMobile ? '28px' : 'auto',
                minHeight: isMobile ? '28px' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                padding: isMobile ? '4px' : '0',
                cursor: 'pointer',
                fontSize: isMobile ? '14px' : '11px',
                color: tok.textFaint,
                transition: 'color 200ms',
                lineHeight: 1,
                minWidth: isMobile ? '28px' : 'auto',
                minHeight: isMobile ? '28px' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={t("common.delete")}
              title={t("common.moveToTrash")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Prompt excerpt */}
        <p
          style={{
            fontSize: isMobile ? '11px' : '10px',
            color: tok.textMuted,
            fontFamily: tok.fontBody,
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: isMobile ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            margin: 0,
          }}
        >
          {image.prompt}
        </p>

        {/* Tags + Embedding badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: isMobile ? '8px' : '6px', flexWrap: 'wrap', gap: '4px' }}>
          <div style={{ display: 'flex', gap: isMobile ? '6px' : '4px', flexWrap: 'wrap', flex: 1 }}>
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
