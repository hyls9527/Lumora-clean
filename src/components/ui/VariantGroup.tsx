import { useEffect } from 'react';
import { useVariantStore } from '../../stores/variantStore';
import { useImageSrc } from '../../hooks/useImageSrc';
import type { ImageRecord } from '../../types/image';
import { t as tok, labelStyle } from '../../lib/tokens';
import { t } from '../../lib/i18n';

interface VariantGroupProps {
  groupId: string | null;
  currentImageId: string;
  onSelect: (image: ImageRecord) => void;
}

function VariantThumb({
  image,
  index,
  onClick,
}: {
  image: ImageRecord;
  index: number;
  onClick: () => void;
}) {
  const src = useImageSrc(image.filePath, { thumbnailMaxWidth: 128 });

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 4,
        border: `1px solid ${tok.border}`,
        borderRadius: 4,
        background: 'none',
        cursor: 'pointer',
        transition: 'border-color 150ms, box-shadow 150ms',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tok.accent;
        e.currentTarget.style.boxShadow = `0 0 0 1px ${tok.accent}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tok.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <img
        src={src ?? undefined}
        alt={image.fileName}
        style={{
          width: 64,
          height: 64,
          objectFit: 'cover',
          borderRadius: 3,
        }}
      />
      <span style={{ fontSize: 11, fontFamily: tok.fontBody, color: tok.textSecondary }}>
        #{index + 1}
      </span>
    </button>
  );
}

export function VariantGroup({
  groupId,
  currentImageId,
  onSelect,
}: VariantGroupProps) {
  const { variants, loading, error, currentGroupId, fetchVariants, clearVariants } =
    useVariantStore();

  useEffect(() => {
    if (groupId && currentGroupId !== groupId) {
      fetchVariants(groupId);
    }
    return () => {
      clearVariants();
    };
  }, [groupId, fetchVariants, clearVariants, currentGroupId]);

  if (!groupId) return null;

  if (loading) {
    return (
      <div>
        <div style={labelStyle}>{t('variants.title')}</div>
        <div style={{ fontSize: 12, color: tok.textSecondary, padding: '8px 0' }}>
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={labelStyle}>{t('variants.title')}</div>
        <div style={{ fontSize: 12, color: tok.danger, padding: '8px 0' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!currentGroupId || variants.length <= 1) return null;

  const otherVariants = variants.filter((v) => v.id !== currentImageId);
  if (otherVariants.length === 0) return null;

  return (
    <div>
      <div style={labelStyle}>
        {t('variants.title')} · {variants.length}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          marginTop: 4,
        }}
      >
        {otherVariants.map((v, i) => (
          <VariantThumb
            key={v.id}
            image={v}
            index={i}
            onClick={() => onSelect(v)}
          />
        ))}
      </div>
    </div>
  );
}
