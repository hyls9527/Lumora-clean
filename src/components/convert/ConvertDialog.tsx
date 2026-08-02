import { useState } from 'react';
import { t } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';
import { batchConvert } from '../../lib/api/images';
import type { BatchConvertResult } from '../../lib/api/images';

interface ConvertDialogProps {
  open: boolean;
  imageIds: string[];
  onClose: () => void;
  onComplete?: (result: BatchConvertResult) => void;
}

const FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'bmp', label: 'BMP' },
  { value: 'gif', label: 'GIF' },
  { value: 'tiff', label: 'TIFF' },
];

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(42, 33, 24, 0.7)',
};

const dialogStyle: React.CSSProperties = {
  background: tok.bg, border: `1px solid ${tok.border}`,
  borderRadius: 8, padding: 24, minWidth: 400,
  display: 'flex', flexDirection: 'column', gap: 16,
  boxShadow: tok.shadowElevated,
};

const btnStyle: React.CSSProperties = {
  fontSize: 12, fontFamily: tok.fontBody, padding: '8px 16px',
  border: `1px solid ${tok.border}`, borderRadius: 4,
  background: tok.surface, color: tok.text, cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: tok.accent, color: tok.bg, borderColor: tok.accent, fontWeight: 600,
};

const formatBtnStyle = (selected: boolean): React.CSSProperties => ({
  ...btnStyle,
  background: selected ? tok.accent : tok.surface,
  color: selected ? tok.bg : tok.text,
  borderColor: selected ? tok.accent : tok.border,
});

export function ConvertDialog({ open, imageIds, onClose, onComplete }: ConvertDialogProps) {
  const [format, setFormat] = useState('png');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<BatchConvertResult | null>(null);

  const handleExecute = async () => {
    if (imageIds.length === 0) return;
    setExecuting(true);
    try {
      const res = await batchConvert(imageIds, format);
      setResult(res);
      onComplete?.(res);
    } catch {
      // handled by tauri.ts wrapper
    } finally {
      setExecuting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('convert.title')}
    >
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontFamily: tok.fontDisplay, fontWeight: 600, color: tok.text }}>
          {t('convert.title')}
          <span style={{ fontSize: 12, fontWeight: 400, color: tok.textSecondary, marginLeft: 8 }}>
            ({imageIds.length} {imageIds.length === 1 ? 'file' : 'files'})
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: tok.textMuted }}>{t('convert.format')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FORMATS.map((fmt) => (
              <button
                key={fmt.value}
                type="button"
                onClick={() => setFormat(fmt.value)}
                style={formatBtnStyle(format === fmt.value)}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {result && (
          <div style={{
            fontSize: 12, fontFamily: tok.fontBody, padding: '8px 12px', borderRadius: 4,
            background: result.failed > 0 ? 'rgba(189, 71, 31, 0.1)' : 'rgba(139, 115, 75, 0.06)',
            color: result.failed > 0 ? tok.danger : tok.text,
          }}>
            {result.failed > 0
              ? t('convert.resultError', undefined, { converted: result.converted, skipped: result.skipped, failed: result.failed })
              : t('convert.result', undefined, { converted: result.converted, skipped: result.skipped })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnStyle}>
            {t('convert.cancel')}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={executing || imageIds.length === 0}
              style={{ ...primaryBtnStyle, opacity: executing ? 0.5 : 1, cursor: executing ? 'not-allowed' : 'pointer' }}
            >
              {executing ? '...' : t('convert.execute')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
