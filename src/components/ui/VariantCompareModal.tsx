import { useEffect } from 'react';
import type { ImageRecord } from '../../types/image';
import { useImageSrc } from '../../hooks/useImageSrc';
import { t } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

interface VariantCompareModalProps {
  open: boolean;
  images: ImageRecord[];
  activeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}

function CompareCard({
  image,
  index,
  isActive,
  onClick,
}: {
  image: ImageRecord;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const src = useImageSrc(image.filePath, { thumbnailMaxWidth: 256 });

  return (
    <button
      type="button"
      data-variant-card
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        border: `2px solid ${isActive ? tok.accent : tok.border}`,
        borderRadius: 6,
        background: isActive ? tok.accentSubtle : 'var(--color-surface)',
        cursor: isActive ? 'default' : 'pointer',
        transition: 'border-color 200ms, box-shadow 200ms',
        flex: '1 1 0',
        minWidth: 160,
        maxWidth: 320,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = tok.accent;
          e.currentTarget.style.boxShadow = `0 0 0 1px ${tok.accent}`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = tok.border;
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {src ? (
        <img
          src={src}
          alt={image.fileName}
          style={{
            width: '100%',
            aspectRatio: `${image.width} / ${image.height}`,
            objectFit: 'contain',
            borderRadius: 3,
            background: 'rgba(139, 115, 75, 0.06)',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '1',
            background: 'rgba(139, 115, 75, 0.08)',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: tok.textMuted,
          }}
        >
          {image.width} × {image.height}
        </div>
      )}
      <span style={{ fontSize: 11, fontFamily: tok.fontBody, color: tok.textSecondary }}>
        #{index + 1}
      </span>
    </button>
  );
}

export function VariantCompareModal({
  open,
  images,
  activeId,
  onClose,
  onSelect,
}: VariantCompareModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || images.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(42, 33, 24, 0.7)',
        animation: 'fadeIn 200ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('variants.compare')}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: 24,
          maxWidth: '90vw',
          overflowX: 'auto',
          animation: 'slideUp 200ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        {images.map((img, i) => (
          <CompareCard
            key={img.id}
            image={img}
            index={i}
            isActive={img.id === activeId}
            onClick={() => {
              if (img.id !== activeId) onSelect(img.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
