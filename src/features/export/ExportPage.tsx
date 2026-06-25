import { useState, useCallback, useEffect } from 'react';
import { useImageStore } from '../../stores/imageStore';
import { useTranslation } from '../../lib/i18n';
import type { ExportResult } from '../../lib/api/images';

export function ExportPage() {
  const { images, selectedIds, fetchImages, exportImages } = useImageStore();
  const { t } = useTranslation();

  const [destDir, setDestDir] = useState('');
  const [format, setFormat] = useState<'original' | 'png' | 'jpg' | 'webp'>('original');
  const [renameTemplate, setRenameTemplate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load images if empty
  useEffect(() => {
    if (images.length === 0) void fetchImages();
  }, []);

  const handleSelectFolder = useCallback(async () => {
    const { open } = await import(/* @vite-ignore */ '@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === 'string') setDestDir(selected);
  }, []);

  const handleExport = useCallback(async () => {
    if (!destDir) return;
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : images.map((img) => img.id);
    if (ids.length === 0) return;

    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await exportImages(ids, destDir, format, renameTemplate || undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [destDir, selectedIds, images, format, renameTemplate, exportImages]);

  const exportCount = selectedIds.size > 0 ? selectedIds.size : images.length;

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: '#2a2118',
              margin: 0,
            }}
          >
            {t('export.title')}
          </h2>
          <p
            style={{
              fontSize: 12,
              color: '#a09480',
              marginTop: 8,
              fontFamily: 'var(--font-body)',
            }}
          >
            {t('export.subtitle')}
          </p>
        </div>

        {/* Export count */}
        <section
          aria-label={t('export.selection')}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid rgba(139, 115, 75, 0.10)',
            borderRadius: 2,
            padding: 20,
            marginBottom: 24,
            boxShadow:
              'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                flexShrink: 0,
                background: selectedIds.size > 0 ? '#7a5c12' : '#a09480',
              }}
            />
            <span style={{ fontSize: 14, color: '#2a2118', fontFamily: 'var(--font-body)' }}>
              {selectedIds.size > 0
                ? t('export.selectedCount', { count: String(selectedIds.size) })
                : t('export.allCount', { count: String(images.length) })}
            </span>
          </div>
        </section>

        {/* Destination folder */}
        <section style={{ marginBottom: 24 }}>
          <SectionHeader>{t('export.destFolder')}</SectionHeader>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={destDir}
              readOnly
              placeholder={t('export.selectDest')}
              aria-label={t('export.destFolder')}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 14,
                outline: 'none',
                background: 'var(--color-surface)',
                border: '1px solid rgba(139, 115, 75, 0.10)',
                borderRadius: 4,
                color: '#2a2118',
                fontFamily: 'var(--font-body)',
              }}
            />
            <button
              type="button"
              onClick={handleSelectFolder}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const,
                fontFamily: 'var(--font-display)',
                color: '#f2ede4',
                background: '#7a5c12',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'background 200ms',
              }}
            >
              {t('export.browse')}
            </button>
          </div>
        </section>

        {/* Output format */}
        <section style={{ marginBottom: 24 }}>
          <SectionHeader>{t('export.outputFormat')}</SectionHeader>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['original', 'png', 'jpg', 'webp'] as const).map((fmt) => (
              <FormatOption
                key={fmt}
                label={fmt.toUpperCase()}
                active={format === fmt}
                onClick={() => setFormat(fmt)}
              />
            ))}
          </div>
        </section>

        {/* Rename template */}
        <section style={{ marginBottom: 32 }}>
          <SectionHeader>{t('export.renameTemplate')}</SectionHeader>
          <input
            type="text"
            value={renameTemplate}
            onChange={(e) => setRenameTemplate(e.target.value)}
            placeholder="{name}"
            aria-label={t('export.renameTemplate')}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 14,
              outline: 'none',
              background: 'var(--color-surface)',
              border: '1px solid rgba(139, 115, 75, 0.10)',
              borderRadius: 4,
              color: '#2a2118',
              fontFamily: 'var(--font-body)',
              transition: 'border-color 200ms',
            }}
          />
          <p
            style={{
              fontSize: 11,
              color: '#a09480',
              marginTop: 8,
              fontFamily: 'var(--font-body)',
            }}
          >
            {t('export.templateHint')}
          </p>
        </section>

        {/* Export button */}
        <div style={{ marginBottom: 32 }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={!destDir || exporting || exportCount === 0}
            style={{
              padding: '10px 32px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
              fontFamily: 'var(--font-display)',
              color: !destDir || exporting || exportCount === 0 ? '#a09480' : '#f2ede4',
              background: !destDir || exporting || exportCount === 0
                ? 'rgba(139, 115, 75, 0.10)'
                : '#7a5c12',
              border: 'none',
              borderRadius: 4,
              cursor: !destDir || exporting || exportCount === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 200ms',
            }}
          >
            {exporting ? t('export.exporting') : t('export.startExport')}
          </button>
        </div>

        {/* Progress / result */}
        {exporting && (
          <div
            style={{
              marginBottom: 32,
              padding: 20,
              background: 'var(--color-surface)',
              border: '1px solid rgba(139, 115, 75, 0.10)',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                color: '#6b5d48',
              }}
            >
              {t('export.exportingProgress', { count: String(exportCount) })}
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 32,
              padding: 16,
              background: 'rgba(139, 48, 48, 0.04)',
              border: '1px solid rgba(139, 48, 48, 0.15)',
              borderRadius: 2,
              fontSize: 13,
              color: '#8b3030',
              fontFamily: 'var(--font-body)',
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <section
            aria-label={t('export.result')}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid rgba(139, 115, 75, 0.10)',
              borderRadius: 2,
              padding: 24,
              boxShadow:
                'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px',
            }}
          >
            <SectionHeader>{t('export.result')}</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ResultRow label={t('export.successCount')} value={String(result.success)} />
              <ResultRow label={t('export.failCount')} value={String(result.failed)} />
              <ResultRow label={t('export.destPath')} value={result.destDir} />
            </div>
            {result.success > 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: '#4a7a3a',
                  marginTop: 16,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {t('export.complete')}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* --- Sub-components --- */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: 16,
        fontFamily: 'var(--font-display)',
        color: '#6b5d48',
        borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
        paddingBottom: 12,
      }}
    >
      {children}
    </h3>
  );
}

function FormatOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        fontFamily: 'var(--font-body)',
        color: active ? '#f2ede4' : '#6b5d48',
        background: active ? '#7a5c12' : 'var(--color-surface)',
        border: `1px solid ${active ? '#7a5c12' : 'rgba(139, 115, 75, 0.10)'}`,
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'all 200ms',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </button>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontSize: 13,
        fontFamily: 'var(--font-body)',
      }}
    >
      <span style={{ width: 100, flexShrink: 0, color: '#6b5d48' }}>{label}</span>
      <span
        style={{
          flex: 1,
          color: '#2a2118',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default ExportPage;
