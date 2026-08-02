import { useEffect, useRef, useState } from 'react';
import type { ImageRecord } from '../../types/image';
import { Rating } from './Rating';
import { TagBadge } from './TagBadge';
import { formatDate, formatFileSize } from '../../lib/format';
import { useImageSrc } from '../../hooks/useImageSrc';
import { useModalEsc } from '../../hooks/useModalEsc';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTouchGesture } from '../../hooks/useTouchGesture';
import { usePerformanceMonitor } from '../../hooks/usePerformance';
import { t } from '../../lib/i18n';
import { t as tok, labelStyle, valueStyle, accentBtnStyle, closeBtnStyle } from '../../lib/tokens';
import { AiAnalysisSection } from './ai/AiAnalysisSection';
import { VariantGroup } from './VariantGroup';
import { VariantCompareModal } from './VariantCompareModal';
import { useVariantStore } from '../../stores/variantStore';

interface DetailModalProps {
  image: ImageRecord | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToggleFavorite?: (id: string) => void;
  onSetRating?: (id: string, rating: number) => void;
  onSearchSimilar?: (id: string) => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(42, 33, 24, 0.6)',
  animation: 'fadeIn 200ms ease-out',
};

const panelStyle: React.CSSProperties = {
  position: 'relative',
  width: '90vw',
  maxWidth: 960,
  maxHeight: '85vh',
  display: 'flex',
  borderRadius: 6,
  background: 'var(--color-surface)',
  border: `1px solid ${tok.border}`,
  boxShadow: 'rgba(139,115,75,0.12) 0px 0px 0px 1px, rgba(78,50,23,0.12) 0px 8px 32px, rgba(78,50,23,0.06) 0px 2px 8px',
  overflow: 'hidden',
  animation: 'slideUp 200ms ease-out',
};

// Mobile-friendly panel style: vertical layout for small screens
const mobilePanelStyle: React.CSSProperties = {
  ...panelStyle,
  flexDirection: 'column',
  maxHeight: '90vh',
};

const previewAreaStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(139, 115, 75, 0.06)',
  minHeight: 400,
  padding: 24,
  overflow: 'hidden',
};

// Mobile preview area: reduced min height
const mobilePreviewAreaStyle: React.CSSProperties = {
  ...previewAreaStyle,
  minHeight: 200,
  padding: 16,
};

const metaPanelStyle: React.CSSProperties = {
  width: 300,
  padding: '24px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  overflowY: 'auto',
  borderLeft: `1px solid ${tok.border}`,
  background: 'var(--color-surface)',
};

// Mobile meta panel: full width, horizontal scroll
const mobileMetaPanelStyle: React.CSSProperties = {
  ...metaPanelStyle,
  width: '100%',
  maxHeight: '40vh',
  borderLeft: 'none',
  borderTop: `1px solid ${tok.border}`,
};

const navBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-surface)',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
  color: tok.textSecondary,
  transition: 'background 200ms, color 200ms',
  zIndex: 2,
};

export function DetailModal({
  image,
  onClose,
  onPrev,
  onNext,
  onToggleFavorite,
  onSetRating,
  onSearchSimilar,
}: DetailModalProps) {
  const imgSrc = useImageSrc(image?.filePath ?? null);
  const [showCompare, setShowCompare] = useState(false);
  const { variants, fetchVariants } = useVariantStore();
  const isMobile = useIsMobile();
  const overlayRef = useRef<HTMLDivElement>(null);

  usePerformanceMonitor('DetailModal');
  useModalEsc(!!image, onClose, overlayRef);

  // Add touch gesture support for mobile
  useTouchGesture({
    onSwipe: (direction) => {
      if (direction.horizontal === 'left') {
        onNext?.();
      } else if (direction.horizontal === 'right') {
        onPrev?.();
      }
    },
    onDoubleTap: () => {
      onToggleFavorite?.(image?.id ?? '');
    },
  });

  useEffect(() => {
    if (!image) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev?.();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [image, onPrev, onNext]);

  if (!image) return null;

  return (
    <div
      ref={overlayRef}
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("common.imageDetail")}
    >
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          style={{ ...navBtnStyle, left: 12 }}
          aria-label={t("common.prevImage")}
        >
          ‹
        </button>
      )}

      <div style={isMobile ? mobilePanelStyle : panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Preview area */}
        <div style={isMobile ? mobilePreviewAreaStyle : previewAreaStyle}>
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={image.fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 2,
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: 600,
                aspectRatio: `${image.width} / ${image.height}`,
                background: 'rgba(139, 115, 75, 0.08)',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                color: tok.textMuted,
                fontFamily: tok.fontBody,
              }}
            >
              {image.width} × {image.height}
            </div>
          )}
        </div>

        {/* Meta panel */}
        <div style={isMobile ? mobileMetaPanelStyle : metaPanelStyle}>
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={closeBtnStyle}
            aria-label={t("common.close")}
          >
            ✕
          </button>

          <h3
            style={{
              fontSize: 16,
              fontFamily: tok.fontDisplay,
              fontWeight: 600,
              color: tok.text,
              margin: 0,
              paddingRight: 24,
              wordBreak: 'break-all',
            }}
          >
            {image.fileName}
          </h3>

          <div>
            <div style={labelStyle}>路径</div>
            <div style={{ ...valueStyle, fontSize: 11, color: tok.textSecondary, wordBreak: 'break-all' }}>
              {image.filePath}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>尺寸</div>
              <div style={valueStyle}>{image.width} × {image.height}</div>
            </div>
            <div>
              <div style={labelStyle}>格式</div>
              <div style={valueStyle}>{image.format.toUpperCase()}</div>
            </div>
            <div>
              <div style={labelStyle}>大小</div>
              <div style={valueStyle}>{formatFileSize(image.fileSizeKb)}</div>
            </div>
            <div>
              <div style={labelStyle}>模型</div>
              <div style={{ ...valueStyle, color: tok.accent }}>{image.model}</div>
            </div>
          </div>

          {/* SD Generation Parameters */}
          {(image.prompt || image.negativePrompt || image.steps != null || image.sampler || image.cfgScale != null || image.seed != null) && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>生成参数</div>
              <div style={{
                background: 'rgba(139, 115, 75, 0.04)',
                borderRadius: 4,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 12,
                fontFamily: tok.fontBody,
                color: tok.textSecondary,
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                {image.prompt && (
                  <div style={{ lineHeight: 1.5 }}>
                    <span style={{ color: tok.textFaint }}>Prompt: </span>
                    <span>{image.prompt}</span>
                  </div>
                )}
                {image.negativePrompt && (
                  <div style={{ lineHeight: 1.5 }}>
                    <span style={{ color: tok.textFaint }}>Negative: </span>
                    <span>{image.negativePrompt}</span>
                  </div>
                )}
                {(image.steps != null || image.sampler || image.cfgScale != null || image.seed != null) && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', lineHeight: 1.6 }}>
                    {image.steps != null && (
                      <span><span style={{ color: tok.textFaint }}>Steps:</span> {image.steps}</span>
                    )}
                    {image.sampler && (
                      <span><span style={{ color: tok.textFaint }}>Sampler:</span> {image.sampler}</span>
                    )}
                    {image.cfgScale != null && (
                      <span><span style={{ color: tok.textFaint }}>CFG:</span> {image.cfgScale}</span>
                    )}
                    {image.seed != null && (
                      <span><span style={{ color: tok.textFaint }}>Seed:</span> {image.seed}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <div style={labelStyle}>评分</div>
            <Rating
              value={image.rating}
              onChange={(v) => onSetRating?.(image.id, v)}
            />
          </div>

          <div>
            <div style={labelStyle}>{t('common.favorite')}</div>
            <button
              type="button"
              onClick={() => onToggleFavorite?.(image.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 14,
                color: image.favorite ? tok.accent : tok.textFaint,
                transition: 'color 200ms',
              }}
              aria-label={image.favorite ? t('common.unfavorite') : t('common.favorite')}
            >
              ◆
            </button>
          </div>

          {image.tags.length > 0 && (
            <div>
              <div style={labelStyle}>标签</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {image.tags.map((tag) => (
                  <TagBadge key={tag} name={tag} />
                ))}
              </div>
            </div>
          )}

          {/* Variant Group */}
          {image.variantGroupId && (
            <VariantGroup
              groupId={image.variantGroupId}
              currentImageId={image.id}
              onSelect={(variant) => {
                // Navigate to variant by dispatching a custom event
                window.dispatchEvent(new CustomEvent('lumora:selectImage', { detail: variant }));
              }}
            />
          )}
n          {image.variantGroupId && (
            <button
              type="button"
              onClick={() => {
                fetchVariants(image.variantGroupId!);
                setShowCompare(true);
              }}
              style={accentBtnStyle}
            >
              {t("variants.compare")}
            </button>
          )}

          {onSearchSimilar && (
            <div>
              <button
                type="button"
                onClick={() => onSearchSimilar(image.id)}
                style={accentBtnStyle}
              >
                以图搜图
              </button>
            </div>
          )}

          {/* AI Analysis Section */}
          <AiAnalysisSection imageId={image.id} />

          <div>
            <div style={labelStyle}>创建时间</div>
            <div style={valueStyle}>{formatDate(image.createdAt)}</div>
          </div>
        </div>
      </div>

      {onNext && (
        <button
          type="button"
          onClick={onNext}
          style={{ ...navBtnStyle, right: 12 }}
          aria-label={t("common.nextImage")}
        >
          ›
        </button>
      )}
n      {/* Variant Compare Modal */}
      <VariantCompareModal
        open={showCompare}
        images={variants}
        activeId={image.id}
        onClose={() => setShowCompare(false)}
        onSelect={(id) => {
          setShowCompare(false);
          const variant = variants.find((v) => v.id === id);
          if (variant) {
            window.dispatchEvent(new CustomEvent("lumora:selectImage", { detail: variant }));
          }
        }}
      />
    </div>
  );
}
