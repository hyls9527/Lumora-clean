import { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';
import { batchRename } from '../../lib/api/images';
import type { RenameResult, RenameItem } from '../../lib/api/images';
import { useModalEsc } from '../../hooks/useModalEsc';

interface RenameDialogProps {
  open: boolean;
  imageIds: string[];
  onClose: () => void;
  onComplete?: (result: RenameResult) => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(42, 33, 24, 0.7)',
};

const MAX_PREVIEW_ROWS = 20;

const dialogStyle: React.CSSProperties = {
  background: tok.bg,
  border: `1px solid ${tok.border}`,
  borderRadius: 12,
  padding: 24,
  minWidth: 480,
  maxWidth: 640,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  boxShadow: tok.shadowElevated,
};

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: tok.fontBody,
  padding: '8px 12px',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  background: tok.surface,
  color: tok.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: tok.fontBody,
  padding: '8px 16px',
  border: `1px solid ${tok.border}`,
  borderRadius: 4,
  background: tok.surface,
  color: tok.text,
  cursor: 'pointer',
  transition: 'background 200ms',
};

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: tok.accent,
  color: tok.bg,
  borderColor: tok.accent,
  fontWeight: 600,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  fontFamily: tok.fontBody,
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: `1px solid ${tok.borderSubtle}`,
  color: tok.textMuted,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: `1px solid ${tok.borderSubtle}`,
  color: tok.text,
  fontSize: 12,
};

const conflictRowStyle: React.CSSProperties = {
  ...tdStyle,
  color: tok.danger,
};

const scrollContainerStyle: React.CSSProperties = {
  overflowY: 'auto',
  maxHeight: 240,
  border: `1px solid ${tok.borderSubtle}`,
  borderRadius: 4,
};

export function RenameDialog({ open, imageIds, onClose, onComplete }: RenameDialogProps) {
  const [template, setTemplate] = useState('');
  const [preview, setPreview] = useState<RenameItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<RenameResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset dialog state each time it opens
  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
    }
  }, [open]);

  useModalEsc(open, onClose, dialogRef);

  // Fetch preview on template change (debounced)
  const fetchPreview = useCallback(
    async (tpl: string) => {
      if (!tpl.trim() || imageIds.length === 0) {
        setPreview(null);
        return;
      }
      setLoading(true);
      try {
        const res = await batchRename(imageIds, tpl.trim(), true);
        setPreview(res.items);
      } catch {
        setPreview(null);
      } finally {
        setLoading(false);
      }
    },
    [imageIds],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!template.trim()) {
      setPreview(null);
      return;
    }
    debounceRef.current = setTimeout(() => fetchPreview(template), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [template, fetchPreview]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTemplate('');
      setPreview(null);
      setResult(null);
      setExecuting(false);
    }
  }, [open]);

  const handleExecute = async () => {
    if (!template.trim() || imageIds.length === 0) return;
    setExecuting(true);
    try {
      const res = await batchRename(imageIds, template.trim(), false);
      setResult(res);
      onComplete?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  };

  if (!open) return null;

  const hasChanges = preview?.some((p) => p.oldName !== p.newName);

  return (
    <div
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t('rename.title')}
    >
      <div ref={dialogRef} style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ fontSize: 15, fontFamily: tok.fontDisplay, fontWeight: 600, color: tok.text }}>
          {t('rename.title')}
          <span style={{ fontSize: 12, fontWeight: 400, color: tok.textSecondary, marginLeft: 8 }}>
            ({t('rename.filesCount', undefined, { count: imageIds.length })})
          </span>
        </div>

        {/* Template Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: tok.textMuted, fontFamily: tok.fontBody }}>
            {t('rename.template')}
          </label>
          <input
            type="text"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder={t('rename.templatePlaceholder')}
            style={inputStyle}
            autoFocus
          />
          <span style={{ fontSize: 10, color: tok.textFaint, fontFamily: tok.fontBody }}>
            {t('rename.templateHint')}
          </span>
        </div>

        {/* Preview */}
        {loading && (
          <div style={{ fontSize: 12, color: tok.textMuted, padding: 8 }}>
            {t('rename.loadingPreview')}
          </div>
        )}

        {!loading && preview && preview.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: tok.textMuted, fontFamily: tok.fontBody }}>
              {t('rename.preview')}
            </span>
            <div style={scrollContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>{t('rename.oldName')}</th>
                    <th style={thStyle}>{t('rename.newName')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, MAX_PREVIEW_ROWS).map((item, i) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>{item.oldName}</td>
                      <td style={item.status === 'conflict' ? conflictRowStyle : tdStyle}>
                        {item.newName}
                        {item.status === 'conflict' && ` (${t('rename.conflict')})`}
                      </td>
                    </tr>
                  ))}
                  {preview.length > MAX_PREVIEW_ROWS && (
                    <tr>
                      <td colSpan={3} style={{ ...tdStyle, color: tok.textMuted, textAlign: 'center' }}>
                        {t('rename.previewMore', undefined, { shown: MAX_PREVIEW_ROWS, total: preview.length })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            style={{
              fontSize: 12,
              fontFamily: tok.fontBody,
              padding: '8px 12px',
              borderRadius: 4,
              background: result.errors > 0 ? tok.dangerBg : 'rgba(139, 115, 75, 0.06)',
              color: result.errors > 0 ? tok.danger : tok.text,
            }}
          >
            {result.errors > 0
              ? t('rename.resultError', undefined, { renamed: result.renamed, skipped: result.skipped, errors: result.errors })
              : t('rename.result', undefined, { renamed: result.renamed, skipped: result.skipped })}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              fontSize: 12,
              fontFamily: tok.fontBody,
              padding: '8px 12px',
              borderRadius: 4,
              background: 'rgba(189, 71, 31, 0.1)',
              color: tok.danger,
            }}
          >
            {t('rename.error')}: {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnStyle}>
            {t('rename.cancel')}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={
                !template.trim() || !hasChanges || executing || imageIds.length === 0
              }
              style={{
                ...primaryBtnStyle,
                opacity: !template.trim() || !hasChanges || executing ? 0.5 : 1,
                cursor: !template.trim() || !hasChanges || executing ? 'not-allowed' : 'pointer',
              }}
            >
              {executing ? t('rename.executing') : t('rename.execute')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
