import { useEffect, useState } from 'react';
import type { ImageRecord } from '../../types/image';
import { Rating } from './Rating';
import { TagBadge } from './TagBadge';
import { formatDate, formatFileSize } from '../../lib/format';
import { convertFileSrc } from '../../lib/tauri';

interface DetailModalProps {
  image: ImageRecord | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToggleFavorite?: (id: string) => void;
  onSetRating?: (id: string, rating: number) => void;
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
  border: '1px solid rgba(139, 115, 75, 0.10)',
  boxShadow: 'rgba(139,115,75,0.12) 0px 0px 0px 1px, rgba(78,50,23,0.12) 0px 8px 32px, rgba(78,50,23,0.06) 0px 2px 8px',
  overflow: 'hidden',
  animation: 'slideUp 200ms ease-out',
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

const metaPanelStyle: React.CSSProperties = {
  width: 300,
  padding: '24px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  overflowY: 'auto',
  borderLeft: '1px solid rgba(139, 115, 75, 0.10)',
  background: 'var(--color-surface)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-display)',
  color: '#a09480',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  color: '#2a2118',
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
  border: '1px solid rgba(139, 115, 75, 0.10)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
  color: '#6b5d48',
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
}: DetailModalProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!image) { setImgSrc(null); return; }
    convertFileSrc(image.filePath).then(setImgSrc).catch(() => setImgSrc(null));
  }, [image?.filePath]);

  useEffect(() => {
    if (!image) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev?.();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [image, onClose, onPrev, onNext]);

  if (!image) return null;

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="图片详情"
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          style={{ ...navBtnStyle, left: 12 }}
          aria-label="上一张"
        >
          ‹
        </button>
      )}

      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Preview area */}
        <div style={previewAreaStyle}>
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
                color: '#a09480',
                fontFamily: 'var(--font-body)',
              }}
            >
              {image.width} × {image.height}
            </div>
          )}
        </div>

        {/* Meta panel */}
        <div style={metaPanelStyle}>
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: '#a09480',
              padding: 4,
              lineHeight: 1,
            }}
            aria-label="关闭"
          >
            ✕
          </button>

          <h3
            style={{
              fontSize: 16,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: '#2a2118',
              margin: 0,
              paddingRight: 24,
              wordBreak: 'break-all',
            }}
          >
            {image.fileName}
          </h3>

          <div>
            <div style={labelStyle}>路径</div>
            <div style={{ ...valueStyle, fontSize: 11, color: '#6b5d48', wordBreak: 'break-all' }}>
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
              <div style={{ ...valueStyle, color: '#7a5c12' }}>{image.model}</div>
            </div>
          </div>

          <div>
            <div style={labelStyle}>评分</div>
            <Rating
              value={image.rating}
              onChange={(v) => onSetRating?.(image.id, v)}
            />
          </div>

          <div>
            <div style={labelStyle}>收藏</div>
            <button
              type="button"
              onClick={() => onToggleFavorite?.(image.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 14,
                color: image.favorite ? '#7a5c12' : '#c4b89e',
                transition: 'color 200ms',
              }}
              aria-label={image.favorite ? '取消收藏' : '收藏'}
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
          aria-label="下一张"
        >
          ›
        </button>
      )}
    </div>
  );
}
